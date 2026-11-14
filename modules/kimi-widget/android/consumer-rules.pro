# Glance 1.1.1 pulls WorkManager 2.7.1 -> Room 2.2.5, which builds WorkDatabase_Impl by
# reflection (Class.newInstance). Room 2.2.5's own rule keeps the class but, under R8 full
# mode (AGP 8+ default), not its no-arg constructor, so release builds crash at startup in
# androidx.startup.InitializationProvider ("Failed to create an instance of WorkDatabase").
-keep class * extends androidx.room.RoomDatabase { <init>(); }
