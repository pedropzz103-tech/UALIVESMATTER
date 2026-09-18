package org.ualivesmatter.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.location.Geocoder
import java.util.Locale
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val locationRequestCode = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = true
        }

        webView.addJavascriptInterface(AndroidBridge(this), "Android")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: android.webkit.GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.scheme == "tel") {
                    startActivity(Intent(Intent.ACTION_DIAL, uri))
                    return true
                }
                return false
            }
        }

        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                locationRequestCode
            )
        }

        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    class AndroidBridge(private val context: Context) {
        @JavascriptInterface
        fun getLastKnownLocation(): String {
            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
            ) return ""

            val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            val location = providers.mapNotNull {
                try { manager.getLastKnownLocation(it) } catch (_: Exception) { null }
            }.maxByOrNull { it.time } ?: return ""

            return "{\"lat\":${location.latitude},\"lng\":${location.longitude}}"
        }

        @JavascriptInterface
        fun getCountryCode(): String {
            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
            ) return "UNKNOWN"

            val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            val location = providers.mapNotNull {
                try { manager.getLastKnownLocation(it) } catch (_: Exception) { null }
            }.maxByOrNull { it.time } ?: return "UNKNOWN"

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
        fun callEmergency(number: String) {
            val activity = context as? Activity ?: return
            activity.runOnUiThread {
                try {
                    activity.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
                } catch (_: Exception) {}
            }
        }
    }
}
