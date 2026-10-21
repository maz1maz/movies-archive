plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// توکن فقط‌خواندنی اپ: از local.properties (gitignored) خونده میشه، توی ریپو commit نمیشه
val appReadToken: String = rootProject.file("local.properties").takeIf { it.exists() }
    ?.readLines()?.firstOrNull { it.startsWith("app_read_token=") }?.substringAfter("=")?.trim() ?: ""

android {
    namespace = "com.cinefilm.archive"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.cinefilm.archive"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "APP_READ_TOKEN", "\"$appReadToken\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
