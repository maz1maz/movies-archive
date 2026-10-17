package com.cinefilm.archive

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.app.Activity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest

private const val SITE_URL = "https://movies-archive.hamidreza-mazlaghani.workers.dev/"
private const val HOME_HOST = "movies-archive.hamidreza-mazlaghani.workers.dev"

class MainActivity : Activity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // تلویزیون و تبلت: صفحه روشن بمونه وقتی فیلم/لیست رو نگاه می‌کنی
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        setContentView(web)

        // لاگین: کوکی سشن (cf_session، Max-Age ۳۰ روز) باید بمونه، وگرنه هر بار دوباره لاگین می‌خوای.
        val cookies = CookieManager.getInstance()
        cookies.setAcceptCookie(true)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            // پوسترها و عکس‌ها از کش WebView هم بیان؛ کنترل کش با هدرهای خود سایت
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            // شناسه‌ی اپ، تا سایت بفهمه داخل اپ اجراست (اختیاری)
            userAgentString = "$userAgentString CinefilmArchiveApp/1.0"
        }

        // فقط همین سایت داخل اپ باز بشه؛ لینک‌های بیرونی (IMDb، یوتیوب، Letterboxd) در مرورگر سیستم
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                if (host == HOME_HOST) return false
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url))
                return true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                // کوکی‌ها رو همین‌جا ذخیره کن تا بعد از بستن اپ هم بمونن
                cookies.flush()
            }
        }
        web.webChromeClient = WebChromeClient()

        // فول‌اسکرین بدون نوار آدرس؛ فوکوس D-pad روی دکمه‌های صفحه کار می‌کنه
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        web.requestFocus()

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(SITE_URL)
    }

    // دکمه Back ریموت/گوشی: اول برگرد صفحه‌ی قبل، وگرنه از اپ بیا بیرون
    @Deprecated("Use onBackPressedDispatcher")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // دکمه‌ی منوی ریموت = رفرش (اگه صفحه گیر کرد)
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            web.reload()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        web.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
