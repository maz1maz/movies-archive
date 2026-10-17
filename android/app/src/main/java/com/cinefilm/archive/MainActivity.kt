package com.cinefilm.archive

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.app.Activity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceError
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

        // پس‌زمینه‌ی تیره از اول، تا اگه صفحه دیر لود شد یا خطا داد، صفحه‌ی سفید خالی نبینی
        window.decorView.setBackgroundColor(Color.BLACK)
        web = WebView(this)
        web.setBackgroundColor(Color.BLACK)
        setContentView(web)
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

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

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                // فقط برای صفحه‌ی اصلی؛ اگه نت یا سرور قطع بود، پیام بده نه صفحه‌ی سفید
                if (request.isForMainFrame) showError(error.description?.toString() ?: "unknown error")
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

    private fun showError(reason: String) {
        val html = """<html><body style="background:#0e0e10;color:#eee;font-family:sans-serif;
            display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0">
            <h2 style="color:#d4af37">اتصال به آرشیو برقرار نشد</h2>
            <p>$reason</p><p>دکمه Menu روی ریموت رو بزن تا دوباره امتحان کنه.</p></body></html>"""
        web.loadDataWithBaseURL(SITE_URL, html, "text/html", "utf-8", null)
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
