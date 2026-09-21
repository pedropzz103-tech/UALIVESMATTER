package org.safekray.app

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class NearbyAlertWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        val context = applicationContext
        val location = lastLocation(context) ?: return Result.success()
        val country = countryCode(context, location)
        if (country == "RU" || country == "UNKNOWN") return Result.success()

        val prefs = context.getSharedPreferences("ualives", Context.MODE_PRIVATE)
        val lastCheck = prefs.getString("nearby_last_check", null)
            ?: isoUtc(System.currentTimeMillis() - 15 * 60 * 1000L)
        var newest = lastCheck

        try {
            val alertsUrl = SUPABASE_URL +
                "/rest/v1/community_alerts?select=id,type,text,lat,lng,created_at&created_at=gt." +
                enc(lastCheck) + "&order=created_at.asc&limit=100"
            val alerts = fetchArray(alertsUrl)

            var shown = 0
            for (i in 0 until alerts.length()) {
                val item = alerts.optJSONObject(i) ?: continue
                val created = item.optString("created_at")
                if (created > newest) newest = created
                val lat = item.optDouble("lat", Double.NaN)
                val lng = item.optDouble("lng", Double.NaN)
                if (lat.isNaN() || lng.isNaN()) continue
                val distance = distanceKm(location.latitude, location.longitude, lat, lng)
                if (distance <= RADIUS_KM && shown < 5) {
                    val type = item.optString("type", "alert")
                    val text = item.optString("text", "")
                    val body = if (text.isBlank()) {
                        distance.toInt().toString() + " km away"
                    } else {
                        text + " · " + distance.toInt().toString() + " km"
                    }
                    showNotification(context, typeLabel(type), body)
                    shown++
                }
            }

            val utilUrl = SUPABASE_URL +
                "/rest/v1/utility_incidents?select=id,service,title,details,lat,lng,created_at,status&created_at=gt." +
                enc(lastCheck) + "&status=eq.active&order=created_at.asc&limit=100"
            val utilities = fetchArray(utilUrl)

            for (i in 0 until utilities.length()) {
                val item = utilities.optJSONObject(i) ?: continue
                val created = item.optString("created_at")
                if (created > newest) newest = created
                val lat = item.optDouble("lat", Double.NaN)
                val lng = item.optDouble("lng", Double.NaN)
                if (lat.isNaN() || lng.isNaN()) continue
                val distance = distanceKm(location.latitude, location.longitude, lat, lng)
                if (distance <= RADIUS_KM && shown < 5) {
                    val service = item.optString("service", "utility")
                    val title = item.optString("title", typeLabel(service))
                    showNotification(
                        context,
                        typeLabel(service),
                        title + " · " + distance.toInt().toString() + " km"
                    )
                    shown++
                }
            }

            prefs.edit().putString("nearby_last_check", newest).apply()
            return Result.success()
        } catch (_: Exception) {
            return Result.retry()
        }
    }

    private fun fetchArray(url: String): JSONArray {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 12000
        connection.readTimeout = 12000
        connection.requestMethod = "GET"
        connection.setRequestProperty("apikey", PUBLISHABLE_KEY)
        connection.setRequestProperty("Accept", "application/json")
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val body = stream.bufferedReader().use { it.readText() }
        connection.disconnect()
        if (code !in 200..299) throw IllegalStateException(body)
        return JSONArray(body)
    }

    private fun lastLocation(context: Context): Location? {
        if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) return null
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull {
                try { manager.getLastKnownLocation(it) } catch (_: Exception) { null }
            }.maxByOrNull { it.time }
    }

    private fun countryCode(context: Context, location: Location): String {
        return try {
            @Suppress("DEPRECATION")
            Geocoder(context, Locale.ENGLISH)
                .getFromLocation(location.latitude, location.longitude, 1)
                ?.firstOrNull()?.countryCode?.uppercase(Locale.ROOT) ?: "UNKNOWN"
        } catch (_: Exception) {
            "UNKNOWN"
        }
    }

    private fun distanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) +
            kotlin.math.cos(Math.toRadians(lat1)) * kotlin.math.cos(Math.toRadians(lat2)) *
            kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)
        return r * 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
    }

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun isoUtc(millis: Long): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(Date(millis))
    }

    private fun typeLabel(type: String): String = when (type) {
        "power" -> "⚡ Power outage nearby"
        "heating" -> "♨️ Heating outage nearby"
        "water" -> "💧 Water outage nearby"
        "fire" -> "🔥 Fire nearby"
        "road" -> "🚧 Road alert nearby"
        "medical" -> "🩹 Medical alert nearby"
        "shelter" -> "🛡️ Shelter alert nearby"
        else -> "⚠️ Safety alert nearby"
    }

    companion object {
        const val CHANNEL_ID = "nearby_safety_alerts"
        private const val SUPABASE_URL = "https://gyroebumaqvsimigveqv.supabase.co"
        private const val PUBLISHABLE_KEY = "sb_publishable_XeVJpZVYGOBQa1IOl6ZIQw_kt92uUNU"
        private const val RADIUS_KM = 20.0

        fun showNotification(context: Context, title: String, message: String) {
            if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) return

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(context, CHANNEL_ID)
            } else {
                Notification.Builder(context)
            }

            val notification = builder
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(Notification.BigTextStyle().bigText(message))
                .setAutoCancel(true)
                .build()

            manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
        }
    }
}
