package com.catsuki.frauddb;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.VideoView;

import java.io.InputStream;

/** 应用内查看图片 / 播放视频，点一下退出 */
public class MediaActivity extends Activity {

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String uriStr = getIntent().getStringExtra("uri");
        boolean video = getIntent().getBooleanExtra("video", false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);

        try {
            if (video) {
                VideoView vv = new VideoView(this);
                MediaController mc = new MediaController(this);
                mc.setAnchorView(vv);
                vv.setMediaController(mc);
                vv.setVideoURI(Uri.parse(uriStr));
                vv.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                    public void onPrepared(MediaPlayer mp) {
                        mp.setLooping(false);
                    }
                });
                vv.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                    public void onCompletion(MediaPlayer mp) {
                        finish();
                    }
                });
                root.addView(vv, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT,
                        Gravity.CENTER));
                vv.start();
            } else {
                ImageView iv = new ImageView(this);
                iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
                Bitmap bmp = decodeSampled(uriStr, 2048);
                if (bmp != null) iv.setImageBitmap(bmp);
                else {
                    TextView tv = new TextView(this);
                    tv.setText("打不开这个文件");
                    tv.setTextColor(0xFFFFFFFF);
                    root.addView(tv, new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                            Gravity.CENTER));
                }
                root.addView(iv, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT,
                        Gravity.CENTER));
            }
        } catch (Throwable e) {
            TextView tv = new TextView(this);
            tv.setText("打开失败：" + e.getMessage());
            tv.setTextColor(0xFFFFFFFF);
            root.addView(tv, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER));
        }

        root.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                finish();
            }
        });
        setContentView(root);
    }

    /** 降采样解码，避免大图 OOM */
    private Bitmap decodeSampled(String uriStr, int maxSide) {
        try {
            Uri uri = Uri.parse(uriStr);
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            InputStream in1 = getContentResolver().openInputStream(uri);
            BitmapFactory.decodeStream(in1, null, opts);
            if (in1 != null) in1.close();
            int sample = 1;
            int big = Math.max(opts.outWidth, opts.outHeight);
            while (big / sample > maxSide) sample *= 2;

            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            InputStream in2 = getContentResolver().openInputStream(uri);
            Bitmap bmp = BitmapFactory.decodeStream(in2, null, o2);
            if (in2 != null) in2.close();
            return bmp;
        } catch (Throwable e) {
            return null;
        }
    }
}
