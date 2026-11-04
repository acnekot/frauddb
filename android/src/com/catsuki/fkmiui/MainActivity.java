package com.catsuki.fkmiui;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.security.MessageDigest;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {

    private static final int REQ_PICK = 7001;
    private static final int REQ_PERM = 7002;
    private static final int REQ_TREE = 7003;
    private static final int SU_TIMEOUT_MS = 12000;
    private static final int LOG_MAX_LINES = 800;
    private static final long LOG_MAX_BYTES = 512 * 1024;

    private static final String[] CANDS = {
            "/data/misc/user/0/securitycenter/fraud_detection_data.db",
            "/data/misc/securitycenter/fraud_detection_data.db",
            "/data/data/com.miui.securitycenter/databases/fraud_detection_data.db",
            "/data/user/0/com.miui.securitycenter/databases/fraud_detection_data.db",
            "/storage/emulated/0/fraud_detection_data.db",
            "/sdcard/fraud_detection_data.db"
    };

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ArrayList<String> ring = new ArrayList<>();
    private File logFile;
    private final SimpleDateFormat ts = new SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US);
    private final SimpleDateFormat tsFull = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        File dir = new File(getFilesDir(), "logs");
        if (!dir.exists()) dir.mkdirs();
        logFile = new File(dir, "frauddb.log");

        web = new WebView(this);
        web.setBackgroundColor(0xFF141218);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        try { ws.setAllowFileAccessFromFileURLs(true); } catch (Throwable ignored) { }
        // 只关缩放：新版 Chromium 忽略 meta 的 user-scalable=no，所以要在 WebView 层拦掉。
        // 注意不要动 useWideViewPort / loadWithOverviewMode，改布局宽度会让页面滑不动。
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) { return true; }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                log("JS/" + m.messageLevel(), m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");

        log("APP", "启动 " + getPackageName() + " v" + versionName()
                + " pid=" + android.os.Process.myPid() + " uid=" + android.os.Process.myUid());
        log("APP", "设备 " + Build.MANUFACTURER + " " + Build.MODEL
                + " / Android " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ")");
        log("APP", "内核 " + System.getProperty("os.version") + " / ABI " + Build.SUPPORTED_ABIS[0]);
        log("APP", "日志文件 " + logFile.getAbsolutePath());
        askPerm();
    }

    private int versionCode() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Throwable e) {
            return 0;
        }
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Throwable e) {
            return "?";
        }
    }

    /* ---------------- 日志 ---------------- */

    private synchronized void log(String tag, String msg) {
        String line = ts.format(new Date()) + " [" + tag + "] " + msg;
        ring.add(line);
        while (ring.size() > LOG_MAX_LINES) ring.remove(0);
        try {
            if (logFile != null && logFile.length() > LOG_MAX_BYTES) {
                File old = new File(logFile.getParentFile(), "frauddb.1.log");
                if (old.exists()) old.delete();
                logFile.renameTo(old);
            }
            FileOutputStream fos = new FileOutputStream(logFile, true);
            fos.write((line + "\n").getBytes("UTF-8"));
            fos.close();
        } catch (Throwable ignored) { }
    }

    private synchronized ArrayList<String> snapshot() {
        return new ArrayList<>(ring);
    }

    /* ---------------- 执行 ---------------- */

    private static class Exec {
        int code = -1;
        byte[] raw = new byte[0];
        String out = "";
        String err = "";
        long ms = 0;
        boolean timeout = false;
        String ioError = null;
    }

    /** 执行一条命令：stdout 按原始字节保留（二进制安全），stderr 单独采集 */
    private Exec run(String[] cmd, int timeoutMs, String label) {
        Exec r = new Exec();
        long t0 = System.currentTimeMillis();
        Process p = null;
        try {
            p = Runtime.getRuntime().exec(cmd);
            final InputStream in = p.getInputStream();
            final InputStream es = p.getErrorStream();
            final ByteArrayOutputStream bos = new ByteArrayOutputStream();
            final ByteArrayOutputStream bes = new ByteArrayOutputStream();
            Thread to = new Thread(new Runnable() {
                public void run() { copy(in, bos); }
            });
            Thread te = new Thread(new Runnable() {
                public void run() { copy(es, bes); }
            });
            to.start(); te.start();
            boolean finished = p.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            if (!finished) {
                r.timeout = true;
                p.destroy();
            }
            to.join(1500); te.join(1500);
            r.code = finished ? p.exitValue() : -2;
            r.raw = bos.toByteArray();
            r.out = preview(r.raw);
            r.err = new String(bes.toByteArray(), "UTF-8").trim();
        } catch (Throwable e) {
            r.ioError = e.getClass().getSimpleName() + ": " + e.getMessage();
        } finally {
            if (p != null) p.destroy();
            r.ms = System.currentTimeMillis() - t0;
        }
        StringBuilder sb = new StringBuilder();
        sb.append(label).append(" → ");
        if (r.ioError != null) sb.append("IO异常 ").append(r.ioError);
        else {
            sb.append("exit=").append(r.timeout ? "TIMEOUT" : String.valueOf(r.code));
            sb.append(" ").append(r.ms).append("ms");
            sb.append(" stdout=").append(r.raw.length).append("B");
            if (!r.out.isEmpty()) sb.append(" ").append(clip(r.out));
            if (!r.err.isEmpty()) sb.append(" err=").append(clip(r.err));
            if (r.raw.length == 0 && r.err.isEmpty()) sb.append(" （无任何输出）");
        }
        log("EXEC", sb.toString());
        return r;
    }

    private static String preview(byte[] b) {
        if (b == null || b.length == 0) return "";
        int n = Math.min(b.length, 200);
        boolean text = true;
        for (int i = 0; i < n; i++) {
            int c = b[i] & 0xff;
            if (c == 0) { text = false; break; }
            if (c < 0x09 || (c > 0x0d && c < 0x20)) { text = false; break; }
        }
        if (text) {
            try {
                String s = new String(b, 0, n, "UTF-8").trim();
                return b.length > n ? s + "…" : s;
            } catch (Throwable ignored) { }
        }
        StringBuilder sb = new StringBuilder("<二进制 " + b.length + "B head=");
        for (int i = 0; i < Math.min(12, b.length); i++) sb.append(String.format("%02x", b[i]));
        return sb.append('>').toString();
    }

    private static boolean looksLikeSqlite(byte[] b) {
        if (b == null || b.length < 16) return false;
        return b[0] == 'S' && b[1] == 'Q' && b[2] == 'L' && b[3] == 'i';
    }

    private static void copy(InputStream in, ByteArrayOutputStream bos) {
        try {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        } catch (Throwable ignored) { }
    }

    private static String clip(String s) {
        s = s.replace("\r", " ").replace("\n", " | ");
        return s.length() > 400 ? s.substring(0, 400) + "…" : s;
    }

    /** 二进制安全地取文件：先 cat，再 base64，最后 sh 包一层 */
    private byte[] readFileAsRoot(String path) {
        Exec a = run(new String[]{"su", "-c", "cat " + path}, SU_TIMEOUT_MS, "root cat " + path);
        if (a.timeout) {
            log("SU", "超时：root 管理器可能弹了授权框但没人点，或者 su 卡在加载策略");
        } else if (looksLikeSqlite(a.raw)) {
            log("SU", "cat 读取成功 " + a.raw.length + " 字节");
            return a.raw;
        } else if (a.code == 0 && a.raw.length > 0) {
            log("SU", "命令返回 0 但拿到的不是 SQLite 文件（" + a.raw.length + " 字节），可能路径不对");
        }
        String low = (a.err + " " + a.out).toLowerCase();
        if (low.contains("permission denied") || low.contains("not allowed") || low.contains("denied"))
            log("SU", "被拒绝：KernelSU 里没给 " + getPackageName() + " 授权，或 su 未放行");

        Exec b = run(new String[]{"su", "-c", "base64 " + path}, SU_TIMEOUT_MS, "root base64 " + path);
        if (b.code == 0 && b.raw.length > 8) {
            try {
                String txt = new String(b.raw, "UTF-8").replaceAll("\\s", "");
                byte[] dec = Base64.decode(txt, Base64.DEFAULT);
                if (looksLikeSqlite(dec)) {
                    log("SU", "base64 读取成功 " + dec.length + " 字节");
                    return dec;
                }
            } catch (Throwable e) {
                log("SU", "base64 解码失败：" + e.getMessage());
            }
        } else if (b.err.toLowerCase().contains("not found")) {
            log("SU", "设备没有 base64 命令，跳过这条兜底");
        }

        Exec c = run(new String[]{"su", "-c", "cp " + path + " /data/local/tmp/fkmiui.db && chmod 644 /data/local/tmp/fkmiui.db && echo OK"},
                SU_TIMEOUT_MS, "root 复制到 /data/local/tmp");
        if (c.code == 0 && c.out.contains("OK")) {
            byte[] d = readFile(new File("/data/local/tmp/fkmiui.db"));
            if (looksLikeSqlite(d)) {
                log("SU", "复制方案成功 " + d.length + " 字节");
                return d;
            }
        }
        return null;
    }

    private static String join(String[] a) {
        StringBuilder sb = new StringBuilder();
        for (String s : a) sb.append(s).append(' ');
        return sb.toString().trim();
    }

    /* ---------------- JS 桥 ---------------- */

    private class Bridge {

        @JavascriptInterface
        public String autoLoad() {
            log("BRIDGE", "autoLoad() 被调用");
            StringBuilder tried = new StringBuilder();
            for (String path : CANDS) {
                File f = new File(path);
                boolean exists = f.exists();
                boolean canRead = f.canRead();
                log("PATH", path + " exists=" + exists + " canRead=" + canRead
                        + (exists ? " size=" + f.length() : ""));
                byte[] data = null;
                if (exists && canRead) {
                    data = readFile(f);
                    if (data != null) log("PATH", "直读成功 " + data.length + " 字节");
                }
                if (data == null) {
                    data = readFileAsRoot(path);
                    if (data != null) log("PATH", "root 读取成功 " + data.length + " 字节");
                }
                if (data != null && data.length > 16) {
                    log("PATH", "命中 " + path);
                    return "{\"ok\":true,\"path\":" + q(path) + ",\"name\":" + q(f.getName())
                            + ",\"b64\":" + q(Base64.encodeToString(data, Base64.NO_WRAP)) + "}";
                }
                tried.append(path).append(' ');
            }
            log("PATH", "六个候选路径全部失败");
            return "{\"ok\":false,\"error\":" + q("没找到数据库文件（已试 " + CANDS.length + " 个路径）")
                    + ",\"tried\":" + q(tried.toString()) + "}";
        }

        @JavascriptInterface
        public void pickFile() {
            log("BRIDGE", "pickFile() 被调用");
            ui.post(new Runnable() {
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    try {
                        startActivityForResult(i, REQ_PICK);
                    } catch (Throwable e) {
                        log("BRIDGE", "打不开文件选择器：" + e);
                        toast("打不开文件选择器");
                    }
                }
            });
        }

        @JavascriptInterface
        public String screenshots() {
            log("BRIDGE", "screenshots() 被调用");
            ArrayList<String> names = new ArrayList<>();
            try {
                String[] proj = {MediaStore.Images.Media.DISPLAY_NAME};
                String sel = MediaStore.Images.Media.DISPLAY_NAME + " LIKE 'Screenshot%' OR "
                        + MediaStore.Images.Media.DISPLAY_NAME + " LIKE '%截图%' OR "
                        + MediaStore.Images.Media.DISPLAY_NAME + " LIKE '%截屏%'";
                Cursor c = getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        proj, sel, null, null);
                if (c != null) {
                    while (c.moveToNext()) {
                        String n = c.getString(0);
                        if (n != null) names.add(n);
                    }
                    c.close();
                }
                log("MEDIA", "查到 " + names.size() + " 个截图文件名");
            } catch (Throwable e) {
                log("MEDIA", "MediaStore 查询失败：" + e);
            }
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < names.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append("{\"name\":").append(q(names.get(i))).append('}');
            }
            return sb.append(']').toString();
        }

        /** 相册里的截图与录屏，返回真实 MediaStore 条目 */
        @JavascriptInterface
        public String media() {
            log("MEDIA", "开始扫描相册（图片 + 视频）");
            StringBuilder out = new StringBuilder("[");
            int count = 0;
            count += queryMedia(out, count, true);
            count += queryMedia(out, count, false);
            out.append(']');
            log("MEDIA", "扫到 " + count + " 个媒体条目");
            return out.toString();
        }

        private int queryMedia(StringBuilder out, int start, boolean images) {
            int added = 0;
            Cursor c = null;
            try {
                String sel;
                String[] proj;
                Uri base;
                if (images) {
                    base = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    proj = new String[]{
                            MediaStore.Images.Media._ID,
                            MediaStore.Images.Media.DISPLAY_NAME,
                            MediaStore.Images.Media.DATE_ADDED,
                            MediaStore.Images.Media.SIZE};
                    sel = MediaStore.Images.Media.DISPLAY_NAME + " LIKE 'Screenshot%' OR "
                            + MediaStore.Images.Media.DISPLAY_NAME + " LIKE '%截图%' OR "
                            + MediaStore.Images.Media.DISPLAY_NAME + " LIKE '%截屏%'";
                } else {
                    base = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                    proj = new String[]{
                            MediaStore.Video.Media._ID,
                            MediaStore.Video.Media.DISPLAY_NAME,
                            MediaStore.Video.Media.DATE_ADDED,
                            MediaStore.Video.Media.SIZE,
                            MediaStore.Video.Media.DURATION};
                    sel = MediaStore.Video.Media.DISPLAY_NAME + " LIKE '%Screenrecord%' OR "
                            + MediaStore.Video.Media.DISPLAY_NAME + " LIKE '%screenrecord%' OR "
                            + MediaStore.Video.Media.DISPLAY_NAME + " LIKE '%录屏%' OR "
                            + MediaStore.Video.Media.DISPLAY_NAME + " LIKE '%屏幕录制%'";
                }
                c = getContentResolver().query(base, proj, sel, null, "date_added DESC");
                if (c == null) {
                    log("MEDIA", (images ? "图片" : "视频") + "查询返回空游标");
                    return 0;
                }
                int iId = c.getColumnIndex(proj[0]);
                int iName = c.getColumnIndex(proj[1]);
                int iAdded = c.getColumnIndex(proj[2]);
                int iSize = c.getColumnIndex(proj[3]);
                int iDur = images ? -1 : c.getColumnIndex(MediaStore.Video.Media.DURATION);
                while (c.moveToNext()) {
                    long id = c.getLong(iId);
                    String name = c.getString(iName);
                    long addedS = c.getLong(iAdded);
                    long size = c.getLong(iSize);
                    long dur = iDur >= 0 ? c.getLong(iDur) : 0;
                    Uri uri = android.content.ContentUris.withAppendedId(base, id);
                    if (out.length() > 1) out.append(',');
                    out.append("{\"kind\":\"").append(images ? "image" : "video").append("\",")
                            .append("\"id\":").append(id).append(',')
                            .append("\"name\":").append(q(name)).append(',')
                            .append("\"added\":").append(addedS).append(',')
                            .append("\"size\":").append(size).append(',')
                            .append("\"dur\":").append(dur).append(',')
                            .append("\"uri\":").append(q(uri.toString())).append('}');
                    added++;
                }
                log("MEDIA", (images ? "图片" : "视频") + " " + added + " 条");
            } catch (Throwable e) {
                log("MEDIA", (images ? "图片" : "视频") + "查询失败：" + e);
            } finally {
                if (c != null) c.close();
            }
            return added;
        }

        /** 取一张缩略图，返回 base64 jpeg（空字符串表示失败） */
        @JavascriptInterface
        public String thumb(String uriStr) {
            try {
                Uri uri = Uri.parse(uriStr);
                android.graphics.Bitmap bmp = null;
                if (Build.VERSION.SDK_INT >= 29) {
                    bmp = getContentResolver().loadThumbnail(uri, new android.util.Size(120, 120), null);
                } else {
                    long id = Long.parseLong(uri.getLastPathSegment());
                    boolean isVideo = uriStr.contains("video");
                    bmp = isVideo
                            ? MediaStore.Video.Thumbnails.getThumbnail(getContentResolver(), id,
                            MediaStore.Video.Thumbnails.MINI_KIND, null)
                            : MediaStore.Images.Thumbnails.getThumbnail(getContentResolver(), id,
                            MediaStore.Images.Thumbnails.MINI_KIND, null);
                }
                if (bmp == null) return "";
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 78, bos);
                bmp.recycle();
                return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
            } catch (Throwable e) {
                log("MEDIA", "缩略图失败 " + uriStr + " → " + e);
                return "";
            }
        }

        /** 在应用内查看 / 播放，不跳出本应用 */
        @JavascriptInterface
        public void openMedia(String uriStr, boolean video) {
            log("MEDIA", "应用内打开 " + (video ? "视频 " : "图片 ") + uriStr);
            try {
                Intent i = new Intent(MainActivity.this, MediaActivity.class);
                i.putExtra("uri", uriStr);
                i.putExtra("video", video);
                startActivity(i);
            } catch (Throwable e) {
                log("MEDIA", "打开失败 " + e);
                toast("打不开这个文件");
            }
        }

        /** 各权限当前状态 */
        @JavascriptInterface
        public String permsState() {
            boolean img = granted(Build.VERSION.SDK_INT >= 33
                    ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE);
            boolean vid = Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.READ_MEDIA_VIDEO);
            boolean call = granted(Manifest.permission.READ_CALL_LOG);
            boolean contacts = granted(Manifest.permission.READ_CONTACTS);
            return "{\"images\":" + img + ",\"video\":" + vid + ",\"calllog\":" + call
                    + ",\"contacts\":" + contacts
                    + ",\"sdk\":" + Build.VERSION.SDK_INT + "}";
        }

        /** 申请某一组权限：media / calllog */
        @JavascriptInterface
        public void requestPerm(String which) {
            log("PERM", "用户请求权限组 " + which);
            String[] ps;
            if ("calllog".equals(which)) {
                ps = new String[]{Manifest.permission.READ_CALL_LOG};
            } else if ("contacts".equals(which)) {
                ps = new String[]{Manifest.permission.READ_CONTACTS};
            } else if (Build.VERSION.SDK_INT >= 33) {
                ps = new String[]{Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO};
            } else {
                ps = new String[]{Manifest.permission.READ_EXTERNAL_STORAGE};
            }
            requestPermissions(ps, REQ_PERM);
        }

        /** 通讯录：号码 + 显示名，带两种 md5 形式 */
        @JavascriptInterface
        public String contacts() {
            if (!granted(Manifest.permission.READ_CONTACTS)) {
                log("BOOK", "没有 READ_CONTACTS，跳过通讯录");
                return "{\"ok\":false,\"error\":\"no-permission\"}";
            }
            log("BOOK", "开始读取通讯录");
            StringBuilder sb = new StringBuilder("{\"ok\":true,\"items\":[");
            int n = 0;
            Cursor c = null;
            java.util.HashSet<String> seen = new java.util.HashSet<>();
            try {
                String[] proj = {
                        android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER};
                c = getContentResolver().query(
                        android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        proj, null, null, null);
                if (c != null) {
                    while (c.moveToNext() && n < 5000) {
                        String name = c.getString(0);
                        String num = c.getString(1);
                        if (num == null) continue;
                        String digits = num.replaceAll("[^0-9+]", "");
                        if (!seen.add(digits)) continue;
                        if (n > 0) sb.append(',');
                        sb.append("{\"name\":").append(q(name))
                                .append(",\"number\":").append(q(num))
                                .append(",\"md5\":").append(q(md5hex(digits)))
                                .append(",\"md5Raw\":").append(q(md5hex(num)))
                                .append('}');
                        n++;
                    }
                }
                log("BOOK", "读到 " + n + " 个联系人号码");
            } catch (Throwable e) {
                log("BOOK", "读取失败 " + e);
                return "{\"ok\":false,\"error\":" + q(String.valueOf(e)) + "}";
            } finally {
                if (c != null) c.close();
            }
            return sb.append("]}").toString();
        }

        /** 系统通话记录，带号码 md5 方便和库里配对 */
        @JavascriptInterface
        public String calllog() {
            if (!granted(Manifest.permission.READ_CALL_LOG)) {
                log("CALL", "没有 READ_CALL_LOG，跳过通话记录");
                return "{\"ok\":false,\"error\":\"no-permission\"}";
            }
            log("CALL", "开始读取通话记录");
            StringBuilder sb = new StringBuilder("{\"ok\":true,\"items\":[");
            int n = 0;
            Cursor c = null;
            try {
                String[] proj = {
                        android.provider.CallLog.Calls.NUMBER,
                        android.provider.CallLog.Calls.CACHED_NAME,
                        android.provider.CallLog.Calls.DATE,
                        android.provider.CallLog.Calls.DURATION,
                        android.provider.CallLog.Calls.TYPE,
                        android.provider.CallLog.Calls.GEOCODED_LOCATION};
                c = getContentResolver().query(android.provider.CallLog.Calls.CONTENT_URI,
                        proj, null, null, android.provider.CallLog.Calls.DATE + " DESC");
                if (c != null) {
                    while (c.moveToNext() && n < 800) {
                        String num = c.getString(0);
                        String name = c.getString(1);
                        long date = c.getLong(2);
                        long dur = c.getLong(3);
                        int type = c.getInt(4);
                        String geo = c.getString(5);
                        if (n > 0) sb.append(',');
                        sb.append("{\"number\":").append(q(num))
                                .append(",\"name\":").append(q(name))
                                .append(",\"date\":").append(date)
                                .append(",\"dur\":").append(dur)
                                .append(",\"type\":").append(type)
                                .append(",\"geo\":").append(q(geo))
                                .append(",\"md5\":").append(q(md5hex(num == null ? "" : num
                                        .replace(" ", "").replace("-", ""))))
                                .append(",\"md5Raw\":").append(q(md5hex(num == null ? "" : num)))
                                .append('}');
                        n++;
                    }
                }
                log("CALL", "读到 " + n + " 条通话记录");
            } catch (Throwable e) {
                log("CALL", "读取失败 " + e);
                return "{\"ok\":false,\"error\":" + q(String.valueOf(e)) + "}";
            } finally {
                if (c != null) c.close();
            }
            return sb.append("]}").toString();
        }

        @JavascriptInterface
        public void exportText(String name, String content) {
            log("BRIDGE", "exportText(" + name + ", " + (content == null ? 0 : content.length()) + " 字符)");
            try {
                File dir = getExternalFilesDir("export");
                if (dir == null) dir = new File(getFilesDir(), "export");
                if (!dir.exists()) dir.mkdirs();
                File out = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(out);
                fos.write(content.getBytes("UTF-8"));
                fos.close();
                log("EXPORT", "已写入 " + out.getAbsolutePath());
                toast("已导出到 " + out.getAbsolutePath());
            } catch (Throwable e) {
                log("EXPORT", "失败：" + e);
                toast("导出失败：" + e.getMessage());
            }
        }

        @JavascriptInterface
        public String md5(String s) {
            return md5hex(s == null ? "" : s);
        }

        /* ---------- 数据库持久化 ---------- */

        private File persistedDb() {
            File d = new File(getFilesDir(), "imported");
            if (!d.exists()) d.mkdirs();
            return new File(d, "fraud_detection_data.db");
        }

        private static final String DB_NAME = "fraud_detection_data.db";

        private Uri storeTree() {
            String s2 = getSharedPreferences("fkmiui", MODE_PRIVATE).getString("storeTree", "");
            return s2 == null || s2.isEmpty() ? null : Uri.parse(s2);
        }

        private String storeLabel() {
            Uri t = storeTree();
            if (t == null) return "应用私有目录";
            String last = t.getLastPathSegment();
            try { last = java.net.URLDecoder.decode(last, "UTF-8"); } catch (Throwable ignored) { }
            int i = last == null ? -1 : last.indexOf(':');
            if (i >= 0) last = last.substring(i + 1);
            return "自定义目录 / " + last;
        }

        private Uri findInTree(Uri tree, String name) {
            try {
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree,
                        DocumentsContract.getTreeDocumentId(tree));
                Cursor c = getContentResolver().query(children, new String[]{
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
                if (c != null) {
                    while (c.moveToNext()) {
                        if (name.equals(c.getString(1))) {
                            Uri u = DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
                            c.close();
                            return u;
                        }
                    }
                    c.close();
                }
            } catch (Throwable e) {
                log("SAVE", "tree 查询失败 " + e);
            }
            return null;
        }

        private boolean writeBytesToStore(byte[] data) throws Exception {
            Uri tree = storeTree();
            if (tree == null) {
                File f = persistedDb();
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(data);
                fos.close();
                return true;
            }
            Uri doc = findInTree(tree, DB_NAME);
            if (doc == null) {
                doc = DocumentsContract.createDocument(getContentResolver(), tree,
                        "application/octet-stream", DB_NAME);
            }
            if (doc == null) throw new Exception("createDocument 返回 null");
            OutputStream os = getContentResolver().openOutputStream(doc, "wt");
            os.write(data);
            os.close();
            return true;
        }

        private byte[] readBytesFromStore() throws Exception {
            Uri tree = storeTree();
            if (tree == null) return readFile(persistedDb());
            Uri doc = findInTree(tree, DB_NAME);
            if (doc == null) return null;
            InputStream in = getContentResolver().openInputStream(doc);
            byte[] d = drain(in);
            in.close();
            return d;
        }

        private boolean deleteFromStore() {
            Uri tree = storeTree();
            if (tree == null) return persistedDb().delete();
            Uri doc = findInTree(tree, DB_NAME);
            if (doc == null) return true;
            try { return DocumentsContract.deleteDocument(getContentResolver(), doc); }
            catch (Throwable e) { log("SAVE", "删除失败 " + e); return false; }
        }

        private File persistedMeta() {
            return new File(new File(getFilesDir(), "imported"), "meta.json");
        }

        private boolean persistEnabled() {
            return getSharedPreferences("fkmiui", MODE_PRIVATE).getBoolean("persist", false);
        }

        @JavascriptInterface
        public String persistInfo() {
            File f = persistedDb();
            boolean on = persistEnabled();
            boolean exists = f.exists() && f.length() > 0;
            String name = "", src = "";
            long savedAt = 0;
            try {
                if (persistedMeta().exists()) {
                    String m = new String(drain(new java.io.FileInputStream(persistedMeta())), "UTF-8");
                    org.json.JSONObject o = new org.json.JSONObject(m);
                    name = o.optString("name", "");
                    src = o.optString("src", "");
                    savedAt = o.optLong("savedAt", 0);
                }
            } catch (Throwable ignored) { }
            String shown = storeTree() == null ? f.getAbsolutePath() : (storeLabel() + " / " + DB_NAME);
            return "{\"enabled\":" + on + ",\"exists\":" + exists
                    + ",\"custom\":" + (storeTree() != null)
                    + ",\"label\":" + q(storeLabel())
                    + ",\"path\":" + q(shown)
                    + ",\"size\":" + (exists ? f.length() : 0)
                    + ",\"name\":" + q(name)
                    + ",\"src\":" + q(src)
                    + ",\"savedAt\":" + savedAt + "}";
        }

        @JavascriptInterface
        public String setPersist(boolean on) {
            getSharedPreferences("fkmiui", MODE_PRIVATE).edit().putBoolean("persist", on).apply();
            log("SAVE", "持久化开关 → " + on);
            if (!on) {
                boolean removed = persistedDb().delete();
                persistedMeta().delete();
                log("SAVE", "关闭持久化，已删除副本 " + removed);
            }
            return persistInfo();
        }

        @JavascriptInterface
        public String persistCurrent(String name, String src, String b64) {
            if (!persistEnabled()) {
                log("SAVE", "持久化未开启，跳过");
                return "{\"ok\":false,\"error\":\"disabled\"}";
            }
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                writeBytesToStore(data);
                org.json.JSONObject meta = new org.json.JSONObject();
                meta.put("name", name == null ? "" : name);
                meta.put("src", src == null ? "" : src);
                meta.put("savedAt", System.currentTimeMillis());
                meta.put("size", data.length);
                FileOutputStream mf = new FileOutputStream(persistedMeta());
                mf.write(meta.toString().getBytes("UTF-8"));
                mf.close();
                String shown = storeTree() == null ? persistedDb().getAbsolutePath()
                        : (storeLabel() + " / " + DB_NAME);
                log("SAVE", "已保存副本 " + shown + " " + data.length + " 字节");
                return "{\"ok\":true,\"path\":" + q(shown) + ",\"size\":" + data.length + "}";
            } catch (Throwable e) {
                log("SAVE", "保存失败 " + e);
                return "{\"ok\":false,\"error\":" + q(String.valueOf(e)) + "}";
            }
        }

        @JavascriptInterface
        public String loadPersisted() {
            if (!persistEnabled()) return "{\"ok\":false,\"error\":\"disabled\"}";
            try {
                byte[] data = readBytesFromStore();
                if (data == null || data.length < 16) return "{\"ok\":false,\"error\":\"read\"}";
                String name = "fraud_detection_data.db", src = "stored";
                try {
                    if (persistedMeta().exists()) {
                        org.json.JSONObject o = new org.json.JSONObject(
                                new String(drain(new java.io.FileInputStream(persistedMeta())), "UTF-8"));
                        name = o.optString("name", name);
                        src = o.optString("src", src);
                    }
                } catch (Throwable ignored) { }
                log("SAVE", "恢复上次导入的副本 " + data.length + " 字节");
                return "{\"ok\":true,\"name\":" + q(name) + ",\"src\":" + q(src)
                        + ",\"b64\":" + q(Base64.encodeToString(data, Base64.NO_WRAP)) + "}";
            } catch (Throwable e) {
                return "{\"ok\":false,\"error\":" + q(String.valueOf(e)) + "}";
            }
        }

        @JavascriptInterface
        public String clearPersisted() {
            long freed = storeTree() == null ? (persistedDb().exists() ? persistedDb().length() : 0) : 0;
            boolean ok = deleteFromStore();
            persistedMeta().delete();
            log("SAVE", "清除副本 " + ok + "，释放 " + freed + " 字节");
            return "{\"ok\":" + ok + ",\"freed\":" + freed + "}";
        }

        @JavascriptInterface
        public void pickStoreDir() {
            ui.post(new Runnable() {
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                    try {
                        startActivityForResult(i, REQ_TREE);
                    } catch (Throwable e) {
                        log("SAVE", "打不开目录选择器 " + e);
                        toast("打不开目录选择器");
                    }
                }
            });
        }

        @JavascriptInterface
        public String resetStoreDir() {
            getSharedPreferences("fkmiui", MODE_PRIVATE).edit().remove("storeTree").apply();
            log("SAVE", "存储位置恢复为应用私有目录");
            return persistInfo();
        }

        @JavascriptInterface
        public void webLog(String tag, String msg) {
            log(tag == null || tag.isEmpty() ? "WEB" : tag, msg == null ? "" : msg);
        }

        @JavascriptInterface
        public String logs() {
            ArrayList<String> lines = snapshot();
            StringBuilder sb = new StringBuilder("{\"file\":").append(q(logFile.getAbsolutePath()))
                    .append(",\"lines\":[");
            for (int i = 0; i < lines.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(q(lines.get(i)));
            }
            return sb.append("]}").toString();
        }

        @JavascriptInterface
        public void clearLogs() {
            synchronized (MainActivity.this) {
                ring.clear();
                if (logFile != null) logFile.delete();
            }
            log("LOG", "日志已清空");
        }

        @JavascriptInterface
        public void copyText(String text) {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("frauddb-log", text));
                log("BRIDGE", "已复制 " + text.length() + " 字符到剪贴板");
                toast("已复制");
            } catch (Throwable e) {
                log("BRIDGE", "复制失败：" + e);
            }
        }

        /** root 自检：每步都记录，返回结构化结果 */
        @JavascriptInterface
        public String selfTest() {
            log("TEST", "===== root 自检开始 =====");
            StringBuilder sb = new StringBuilder("{\"steps\":[");
            String[][] steps = {
                    {"当前身份", "id"},
                    {"SELinux", "getenforce"},
                    {"su 版本", "su -v"},
                    {"su 提权", "su -c id"},
                    {"目标目录", "su -c ls -ld /data/misc/user/0/securitycenter"},
                    {"目标文件", "su -c ls -l /data/misc/user/0/securitycenter/fraud_detection_data.db"},
                    {"KSU 管理器", "pm list packages | grep -i -E 'kernelsu|resukisu|bakasu|kowsu|apatch|magisk'"},
                    {"KSU 守护", "su -c /data/adb/ksu/bin/ksud -V"}
            };
            for (int i = 0; i < steps.length; i++) {
                String[] cmd;
                if (steps[i][1].startsWith("su ") || steps[i][1].startsWith("pm ")) {
                    cmd = new String[]{"sh", "-c", steps[i][1]};
                } else {
                    cmd = new String[]{steps[i][1]};
                }
                Exec r = run(cmd, SU_TIMEOUT_MS, steps[i][0] + ": " + steps[i][1]);
                if (i > 0) sb.append(',');
                sb.append("{\"name\":").append(q(steps[i][0]))
                        .append(",\"cmd\":").append(q(steps[i][1]))
                        .append(",\"code\":").append(r.timeout ? -2 : r.code)
                        .append(",\"out\":").append(q(clip2(r.out)))
                        .append(",\"err\":").append(q(clip2(r.err))).append('}');
            }
            sb.append(']');
            String verdict = verdict();
            log("TEST", "结论：" + verdict);
            log("TEST", "===== root 自检结束 =====");
            return sb.append(",\"verdict\":").append(q(verdict)).append('}').toString();
        }

        @JavascriptInterface
        public String versionInfo() {
            return "{\"name\":" + q(versionName()) + ",\"code\":" + versionCode() + "}";
        }

        /** 查 GitHub 最新 Release，并和本地版本比较 */
        @JavascriptInterface
        public String checkUpdate() {
            final String api = "https://api.github.com/repos/acnekot/frauddb/releases/latest";
            log("UPD", "检查更新 " + api);
            long t0 = System.currentTimeMillis();
            try {
                String body = httpGet(api);
                log("UPD", "HTTP 200，返回 " + body.length() + " 字符，耗时 " + (System.currentTimeMillis() - t0) + "ms");
                JSONObject o = new JSONObject(body);
                String tag = o.optString("tag_name", "");
                String title = o.optString("name", tag);
                String notes = o.optString("body", "");
                String page = o.optString("html_url", "");
                String apk = "";
                long size = 0;
                JSONArray assets = o.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject a = assets.getJSONObject(i);
                        String n = a.optString("name", "");
                        if (n.endsWith(".apk")) {
                            apk = a.optString("browser_download_url", "");
                            size = a.optLong("size", 0);
                            break;
                        }
                    }
                }
                int cmp = compareVersion(tag, versionName());
                boolean newer = cmp > 0;
                log("UPD", "本地 " + versionName() + " 最新 " + tag + " → " + (newer ? "有更新" : "已是最新")
                        + (apk.isEmpty() ? "（该 Release 没有 APK 附件）" : ""));
                return "{\"ok\":true,\"current\":" + q(versionName())
                        + ",\"latest\":" + q(tag) + ",\"title\":" + q(title)
                        + ",\"notes\":" + q(notes) + ",\"page\":" + q(page)
                        + ",\"apk\":" + q(apk) + ",\"size\":" + size
                        + ",\"hasUpdate\":" + newer + "}";
            } catch (Throwable e) {
                String msg = e.getClass().getSimpleName() + ": " + e.getMessage();
                log("UPD", "检查失败 " + msg);
                return "{\"ok\":false,\"current\":" + q(versionName()) + ",\"error\":" + q(msg) + "}";
            }
        }

        /** 下载 APK 到应用私有目录，返回提示用 JSON */
        @JavascriptInterface
        public String downloadUpdate(String url) {
            log("UPD", "开始下载 " + url);
            HttpURLConnection c = null;
            try {
                File dir = getExternalFilesDir("update");
                if (dir == null) dir = new File(getFilesDir(), "update");
                if (!dir.exists()) dir.mkdirs();
                String fileName = url.substring(url.lastIndexOf('/') + 1);
                if (!fileName.endsWith(".apk")) fileName = "fkmiui-update.apk";
                File out = new File(dir, fileName);

                c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestProperty("User-Agent", "fkmiui/" + versionName());
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                int code = c.getResponseCode();
                long total = c.getContentLength();
                log("UPD", "下载响应 " + code + " 大小 " + total);
                if (code != 200) return "{\"ok\":false,\"error\":" + q("HTTP " + code) + "}";

                InputStream in = c.getInputStream();
                OutputStream fos = new FileOutputStream(out);
                byte[] buf = new byte[32 * 1024];
                long done = 0;
                int n, lastMark = 0;
                while ((n = in.read(buf)) > 0) {
                    fos.write(buf, 0, n);
                    done += n;
                    int pct = total > 0 ? (int) (done * 100 / total) : 0;
                    if (pct >= lastMark + 25) {
                        lastMark = pct;
                        log("UPD", "已下载 " + pct + "%（" + done + "/" + total + "）");
                    }
                }
                fos.close();
                in.close();
                log("UPD", "下载完成 " + out.getAbsolutePath() + " " + done + " 字节");
                return "{\"ok\":true,\"name\":" + q(fileName) + ",\"size\":" + done
                        + ",\"path\":" + q(out.getAbsolutePath()) + "}";
            } catch (Throwable e) {
                String msg = e.getClass().getSimpleName() + ": " + e.getMessage();
                log("UPD", "下载失败 " + msg);
                return "{\"ok\":false,\"error\":" + q(msg) + "}";
            } finally {
                if (c != null) c.disconnect();
            }
        }

        /** 调起系统安装器 */
        @JavascriptInterface
        public void installUpdate(String fileName) {
            log("UPD", "准备安装 " + fileName);
            try {
                if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                    log("UPD", "没有「安装未知应用」权限，跳去设置页");
                    toast("请先允许本应用安装应用");
                    Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName()));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                    return;
                }
                Uri uri = Uri.parse("content://" + UpdateProvider.AUTHORITY + "/" + fileName);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                log("UPD", "已调起安装器");
            } catch (Throwable e) {
                log("UPD", "安装失败 " + e);
                toast("安装失败：" + e.getMessage());
            }
        }

        @JavascriptInterface
        public void openUrl(String url) {
            log("UPD", "打开链接 " + url);
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable e) {
                log("UPD", "打开失败 " + e);
                toast("没有可用的浏览器");
            }
        }

        @JavascriptInterface
        public void toast(String msg) {
            final String m = msg;
            ui.post(new Runnable() {
                public void run() {
                    Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private static String clip2(String s) {
        s = s.replace("\r", " ").replace("\n", " | ");
        return s.length() > 500 ? s.substring(0, 500) + "…" : s;
    }

    /** 根据刚才的执行结果给一句人话结论 */
    private String verdict() {
        ArrayList<String> lines = snapshot();
        StringBuilder all = new StringBuilder();
        for (String l : lines) all.append(l).append('\n');
        String s = all.toString();
        String tail = s.length() > 20000 ? s.substring(s.length() - 20000) : s;

        if (tail.contains("uid=0(root)")) return "root 通道可用，直接读取即可";
        if (tail.contains("permission denied") || tail.contains("Permission denied"))
            return "su 被拒绝：去 KernelSU 管理器里给 " + getPackageName() + " 打开授权开关";
        if (tail.contains("su: not found") || tail.contains("inaccessible or not found"))
            return "找不到 su：KernelSU 没装好，或者 late-load 没成功";
        if (tail.contains("TIMEOUT"))
            return "调用超时：可能在等授权弹窗，或者 ksud 卡住了";
        if (tail.contains("permission_denied") || tail.contains("SELinux"))
            return "看 SELinux 与 su 两步的输出，常见是 enforcing 下 su 拒绝连接";
        return "信息不足，把完整日志发出来";
    }

    /* ---------------- 文件读取 ---------------- */

    private static byte[] readFile(File f) {
        try {
            InputStream in = new java.io.FileInputStream(f);
            byte[] d = drain(in);
            in.close();
            return d;
        } catch (Throwable e) {
            return null;
        }
    }

    private static byte[] drain(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    private void askPerm() {
        String[] ps;
        if (Build.VERSION.SDK_INT >= 33) {
            ps = new String[]{Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO};
        } else {
            ps = new String[]{Manifest.permission.READ_EXTERNAL_STORAGE};
        }
        boolean need = false;
        for (String p : ps) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) need = true;
            log("PERM", p + (checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED ? " 已授予" : " 待申请"));
        }
        if (need) requestPermissions(ps, REQ_PERM);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        for (int i = 0; i < perms.length; i++) {
            log("PERM", perms[i] + " → " + (res[i] == PackageManager.PERMISSION_GRANTED ? "授予" : "拒绝"));
        }
        if (web != null) {
            web.post(new Runnable() {
                public void run() {
                    web.evaluateJavascript("window.appPermChanged && window.appPermChanged()", null);
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);

        if (req == REQ_TREE) {
            if (res != RESULT_OK || data == null || data.getData() == null) {
                log("SAVE", "用户取消选择目录");
                return;
            }
            Uri tree = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(tree,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Throwable e) {
                log("SAVE", "持久化目录权限失败 " + e);
            }
            getSharedPreferences("fkmiui", MODE_PRIVATE).edit()
                    .putString("storeTree", tree.toString()).apply();
            log("SAVE", "存储位置改为 " + tree);
            if (web != null) {
                web.post(new Runnable() {
                    public void run() {
                        web.evaluateJavascript("window.appStoreChanged && window.appStoreChanged()", null);
                    }
                });
            }
            return;
        }

        if (req != REQ_PICK) return;
        if (res != RESULT_OK || data == null || data.getData() == null) {
            log("PICK", "用户取消或没有返回文件");
            return;
        }
        Uri uri = data.getData();
        String name = "database.db";
        try {
            Cursor c = getContentResolver().query(uri, null, null, null, null);
            if (c != null) {
                int idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if (idx >= 0 && c.moveToFirst()) name = c.getString(idx);
                c.close();
            }
        } catch (Throwable ignored) { }
        try {
            InputStream in = getContentResolver().openInputStream(uri);
            byte[] bytes = drain(in);
            in.close();
            log("PICK", "读取 " + name + " " + bytes.length + " 字节");
            final String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            final String nm = name;
            ui.post(new Runnable() {
                public void run() {
                    web.evaluateJavascript("window.onPickedDb(" + q(nm) + "," + q(b64) + ")", null);
                }
            });
        } catch (Throwable e) {
            log("PICK", "读取失败：" + e);
            toast("读取失败：" + e.getMessage());
        }
    }

    private void toast(String m) {
        final String msg = m;
        ui.post(new Runnable() {
            public void run() {
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private boolean granted(String p) {
        try {
            return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
        } catch (Throwable e) {
            return false;
        }
    }

    private static String md5hex(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] d = md.digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte x : d) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Throwable e) {
            return "";
        }
    }

    private static String httpGet(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setRequestProperty("User-Agent", "fkmiui-update-check");
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            int code = c.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code);
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            in.close();
            return new String(bos.toByteArray(), "UTF-8");
        } finally {
            c.disconnect();
        }
    }

    /** 只比数字段：v1.3 > v1.2.9 */
    private static int compareVersion(String a, String b) {
        int[] x = nums(a), y = nums(b);
        int len = Math.max(x.length, y.length);
        for (int i = 0; i < len; i++) {
            int p = i < x.length ? x[i] : 0;
            int q2 = i < y.length ? y[i] : 0;
            if (p != q2) return p > q2 ? 1 : -1;
        }
        return 0;
    }

    private static int[] nums(String s) {
        if (s == null) return new int[0];
        String t = s.replaceAll("[^0-9.]", "");
        String[] parts = t.split("\\.");
        ArrayList<Integer> out = new ArrayList<>();
        for (String p : parts) {
            if (p.isEmpty()) continue;
            try { out.add(Integer.parseInt(p)); } catch (Throwable ignored) { }
        }
        int[] r = new int[out.size()];
        for (int i = 0; i < r.length; i++) r[i] = out.get(i);
        return r;
    }

    private static String q(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder(s.length() + 16);
        b.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }
}
