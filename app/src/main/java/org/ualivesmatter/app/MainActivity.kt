package org.ualivesmatter.app

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.graphics.Color
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val permissionRequestCode = 1001
    private val fileChooserRequestCode = 2001
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingDeepLink: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingDeepLink = intent?.dataString

        createNotificationChannel()
        requestRuntimePermissions()
        scheduleNearbyAlertWorker()
        configureSystemBars()

        webView = WebView(this).apply {
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            setBackgroundColor(Color.WHITE)
        }
        setContentView(webView)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
        }

        webView.addJavascriptInterface(AndroidBridge(this), "Android")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: android.webkit.GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                val chooserIntent = try {
                    fileChooserParams?.createIntent()
                } catch (_: Exception) {
                    null
                } ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                return try {
                    startActivityForResult(chooserIntent, fileChooserRequestCode)
                    true
                } catch (_: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.scheme == "tel") {
                    startActivity(Intent(Intent.ACTION_DIAL, uri))
                    return true
                }
                if (uri.scheme == "ualivesmatter" && uri.host == "auth") {
                    pendingDeepLink = uri.toString()
                    deliverPendingDeepLink()
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                deliverPendingDeepLink()
            }
        }

        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingDeepLink = intent?.dataString
        deliverPendingDeepLink()
    }

    private fun deliverPendingDeepLink() {
        if (!::webView.isInitialized) return
        val link = pendingDeepLink ?: return
        val quoted = JSONObject.quote(link)
        webView.evaluateJavascript(
            "window.handleAuthDeepLink && window.handleAuthDeepLink($quoted);",
            null
        )
        pendingDeepLink = null
    }

    private fun configureSystemBars() {
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            )
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
    }

    private fun requestRuntimePermissions() {
        val permissions = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions += Manifest.permission.ACCESS_FINE_LOCATION
            permissions += Manifest.permission.ACCESS_COARSE_LOCATION
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            permissions += Manifest.permission.POST_NOTIFICATIONS
        }
        if (permissions.isNotEmpty()) {
            requestPermissions(permissions.distinct().toTypedArray(), permissionRequestCode)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                NearbyAlertWorker.CHANNEL_ID,
                "Nearby safety alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Community and utility alerts near your location"
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun scheduleNearbyAlertWorker() {
        val request = PeriodicWorkRequest.Builder(
            NearbyAlertWorker::class.java,
            15,
            TimeUnit.MINUTES
        ).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "nearby-safety-alerts",
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == fileChooserRequestCode) {
            val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    class AndroidBridge(private val context: Context) {
        @JavascriptInterface
        fun getLastKnownLocation(): String {
            val location = lastLocation(context) ?: return ""
            return "{\"lat\":${location.latitude},\"lng\":${location.longitude}}"
        }

        @JavascriptInterface
        fun getCountryCode(): String {
            val location = lastLocation(context) ?: return "UNKNOWN"
            return try {
                @Suppress("DEPRECATION")
                val addresses = Geocoder(context, Locale.ENGLISH)
                    .getFromLocation(location.latitude, location.longitude, 1)
                addresses?.firstOrNull()?.countryCode?.uppercase(Locale.ROOT) ?: "UNKNOWN"
            } catch (_: Exception) {
                "UNKNOWN"
            }
        }

        @JavascriptInterface
        fun setAuthToken(token: String) {
            context.getSharedPreferences("ualives", Context.MODE_PRIVATE)
                .edit().putString("auth_token", token).apply()
        }

        @JavascriptInterface
        fun clearAuthToken() {
            context.getSharedPreferences("ualives", Context.MODE_PRIVATE)
                .edit().remove("auth_token").apply()
        }

        @JavascriptInterface
        fun notifyNearbyAlert(title: String, message: String) {
            NearbyAlertWorker.showNotification(context, title, message)
        }

        @JavascriptInterface
        fun haptic(style: String = "light") {
            val activity = context as? Activity ?: return
            activity.runOnUiThread {
                val feedback = when (style.lowercase(Locale.ROOT)) {
                    "strong" -> HapticFeedbackConstants.LONG_PRESS
                    "tick" -> HapticFeedbackConstants.CLOCK_TICK
                    else -> HapticFeedbackConstants.KEYBOARD_TAP
                }
                activity.window.decorView.performHapticFeedback(feedback)
            }
        }

        @JavascriptInterface
        fun openExternal(url: String) {
            val activity = context as? Activity ?: return
            activity.runOnUiThread {
                try {
                    activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun callEmergency(number: String) {
            val activity = context as? Activity ?: return
            activity.runOnUiThread {
                try {
                    activity.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
                } catch (_: Exception) {}
            }
        }

        companion object {
            private fun lastLocation(context: Context): android.location.Location? {
                if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                    context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
                ) return null
                val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
                    .mapNotNull { provider ->
                        try { manager.getLastKnownLocation(provider) } catch (_: Exception) { null }
                    }
                    .maxByOrNull { it.time }
            }
        }
    }
}
