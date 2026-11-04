package com.catsuki.fkmiui;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

public class MainActivity extends Activity {

    private static final int REQ_PICK = 7001;
    private static final int REQ_PERM = 7002;

    /** 常见落盘位置，按优先级排列 */
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

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setBackgroundColor(0xFF141218);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        try { ws.setAllowFileAccessFromFileURLs(true); } catch (Throwable ignored) { }
        ws.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        askPerm();
    }

    private void askPerm() {
        String p = Build.VERSION.SDK_INT >= 33
                ? Manifest.permission.READ_MEDIA_IMAGES
                : Manifest.permission.READ_EXTERNAL_STORAGE;
        if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{p}, REQ_PERM);
        }
    }

    /* ---------------- JS 桥 ---------------- */

    private class Bridge {

        @JavascriptInterface
        public String autoLoad() {
            StringBuilder tried = new StringBuilder();
            for (String path : CANDS) {
                byte[] data = null;
                try {
                    File f = new File(path);
                    if (f.exists() && f.canRead()) data = readFile(f);
                } catch (Throwable ignored) { }
                if (data == null) data = readAsRoot(path, tried);
                if (data != null && data.length > 16) {
                    return "{\"ok\":true,\"path\":" + q(path) + ",\"name\":" + q(new File(path).getName())
                            + ",\"b64\":" + q(Base64.encodeToString(data, Base64.NO_WRAP)) + "}";
                }
            }
            String err = "没找到数据库文件（已试 " + CANDS.length + " 个路径）";
            return "{\"ok\":false,\"error\":" + q(err) + ",\"tried\":" + q(tried.toString()) + "}";
        }

        @JavascriptInterface
        public void pickFile() {
            ui.post(new Runnable() {
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    try {
                        startActivityForResult(i, REQ_PICK);
                    } catch (Throwable e) {
                        toast("打不开文件选择器");
                    }
                }
            });
        }

        @JavascriptInterface
        public String screenshots() {
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
            } catch (Throwable ignored) { }
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < names.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append("{\"name\":").append(q(names.get(i))).append('}');
            }
            return sb.append(']').toString();
        }

        @JavascriptInterface
        public void exportText(String name, String content) {
            try {
                File dir = getExternalFilesDir("export");
                if (dir == null) dir = new File(getFilesDir(), "export");
                if (!dir.exists()) dir.mkdirs();
                File out = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(out);
                fos.write(content.getBytes("UTF-8"));
                fos.close();
                toast("已导出到 " + out.getAbsolutePath());
            } catch (Throwable e) {
                toast("导出失败：" + e.getMessage());
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

    /** 走 su 读单文件 */
    private static byte[] readAsRoot(String path, StringBuilder log) {
        String[][] cmds = {
                {"su", "-c", "cat " + path},
                {"su", "0", "cat", path},
                {"su", "-c", "/system/bin/cat " + path}
        };
        for (String[] cmd : cmds) {
            Process p = null;
            try {
                p = Runtime.getRuntime().exec(cmd);
                byte[] data = drain(p.getInputStream());
                int code = p.waitFor();
                if (code == 0 && data != null && data.length > 16) return data;
                log.append(cmd[0]).append(' ').append(code).append(';');
            } catch (Throwable e) {
                log.append("x;");
            } finally {
                if (p != null) p.destroy();
            }
        }
        return null;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_PICK || res != RESULT_OK || data == null || data.getData() == null) return;
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
            final String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            final String nm = name;
            ui.post(new Runnable() {
                public void run() {
                    web.evaluateJavascript("window.onPickedDb(" + q(nm) + "," + q(b64) + ")", null);
                }
            });
        } catch (Throwable e) {
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
