-- TerraMarine Database Schema
-- Compatible with PostgreSQL 13+

-- Enable uuid-ossp extension for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables in reverse order of creation to avoid foreign key errors (for clean re-run)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS iot_devices CASCADE;
DROP TABLE IF EXISTS ai_chat_messages CASCADE;
DROP TABLE IF EXISTS ai_predictions CASCADE;
DROP TABLE IF EXISTS report_updates CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS weather_alerts CASCADE;
DROP TABLE IF EXISTS biodiversity_reports CASCADE;
DROP TABLE IF EXISTS route_stops CASCADE;
DROP TABLE IF EXISTS cleanup_routes CASCADE;
DROP TABLE IF EXISTS cleanup_tasks CASCADE;
DROP TABLE IF EXISTS campaign_volunteers CASCADE;
DROP TABLE IF EXISTS cleanup_campaigns CASCADE;
DROP TABLE IF EXISTS pollution_reports CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom ENUM types
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS device_type CASCADE;
DROP TYPE IF EXISTS sender_type CASCADE;
DROP TYPE IF EXISTS alert_type CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS campaign_status CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS severity_level CASCADE;
DROP TYPE IF EXISTS report_category CASCADE;
DROP TYPE IF EXISTS account_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- -------------------------------------------------------------
-- 1. Create ENUM Types
-- -------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
    'Citizen', 
    'Fisherman', 
    'NGO', 
    'Authority', 
    'Volunteer', 
    'Researcher', 
    'Admin'
);

CREATE TYPE account_status AS ENUM (
    'Active', 
    'Inactive', 
    'Suspended',
    'Pending',
    'Rejected'
);

CREATE TYPE report_category AS ENUM (
    'Pollution', 
    'Emergency'
);

CREATE TYPE severity_level AS ENUM (
    'Low', 
    'Medium', 
    'High'
);

CREATE TYPE report_status AS ENUM (
    'Pending', 
    'Verified', 
    'Completed'
);

CREATE TYPE campaign_status AS ENUM (
    'Upcoming', 
    'Ongoing', 
    'Completed', 
    'Cancelled'
);

CREATE TYPE task_status AS ENUM (
    'Pending', 
    'In Progress', 
    'Completed', 
    'Verified'
);

CREATE TYPE alert_type AS ENUM (
    'Weather', 
    'Marine'
);

CREATE TYPE sender_type AS ENUM (
    'User', 
    'Assistant'
);

CREATE TYPE device_type AS ENUM (
    'WasteBin', 
    'WaterQuality'
);

CREATE TYPE payment_status AS ENUM (
    'Pending', 
    'Paid', 
    'Failed'
);

-- -------------------------------------------------------------
-- 2. Create Tables
-- -------------------------------------------------------------

-- 1. Users
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    organization_name VARCHAR(150) NULL,
    profile_image TEXT NULL,
    address TEXT NULL,
    district VARCHAR(50) NULL,
    state VARCHAR(50) NULL,
    status account_status NOT NULL DEFAULT 'Active',
    reset_password_token VARCHAR(255) NULL,
    reset_password_expires TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- NGO fields
    registration_number VARCHAR(100) NULL,
    organization_address TEXT NULL,
    registration_certificate_url TEXT NULL,

    -- Researcher fields
    institution_name VARCHAR(150) NULL,
    department VARCHAR(100) NULL,
    research_area VARCHAR(150) NULL,
    institution_id_url TEXT NULL,

    -- Volunteer fields
    government_id_type VARCHAR(50) NULL,
    government_id_number VARCHAR(100) NULL,
    government_id_url TEXT NULL,

    -- Fisherman fields
    fishing_license_number VARCHAR(100) NULL,
    boat_registration_number VARCHAR(100) NULL
);

-- 2. Pollution Reports
CREATE TABLE pollution_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    report_category report_category NOT NULL DEFAULT 'Pollution',
    title VARCHAR(150) NOT NULL,
    description TEXT,
    image_url TEXT,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    location_name VARCHAR(150),
    waste_type VARCHAR(50),
    severity severity_level,
    status report_status NOT NULL DEFAULT 'Pending',
    reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL
);

-- 3. Cleanup Campaigns
CREATE TABLE cleanup_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    campaign_name VARCHAR(150) NOT NULL,
    description TEXT,
    campaign_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location VARCHAR(150),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    maximum_volunteers INT,
    status campaign_status NOT NULL DEFAULT 'Upcoming',
    visibility VARCHAR(20) DEFAULT 'Public',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Campaign Volunteers
CREATE TABLE campaign_volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES cleanup_campaigns(campaign_id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_date TIMESTAMP NOT NULL DEFAULT NOW(),
    attendance BOOLEAN NOT NULL DEFAULT FALSE,
    certificate_status BOOLEAN NOT NULL DEFAULT FALSE,
    registration_status VARCHAR(20) DEFAULT 'Approved',
    CONSTRAINT unique_campaign_volunteer UNIQUE (campaign_id, volunteer_id)
);

-- 5. Cleanup Tasks
CREATE TABLE cleanup_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pollution_reports(report_id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES cleanup_campaigns(campaign_id) ON DELETE SET NULL,
    assigned_worker UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_date TIMESTAMP NULL,
    deadline DATE NULL,
    status task_status NOT NULL DEFAULT 'Pending',
    before_image TEXT NULL,
    after_image TEXT NULL,
    completion_notes TEXT NULL,
    completed_date TIMESTAMP NULL
);

-- 6. Cleanup Routes (AI Module 3)
CREATE TABLE cleanup_routes (
    route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES cleanup_campaigns(campaign_id) ON DELETE SET NULL,
    worker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    total_distance_km DECIMAL(6,2),
    estimated_duration_minutes INT,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. Route Stops (AI Module 3)
CREATE TABLE route_stops (
    stop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES cleanup_routes(route_id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES cleanup_tasks(task_id) ON DELETE CASCADE,
    stop_order INT NOT NULL,
    CONSTRAINT unique_route_stop_order UNIQUE (route_id, stop_order)
);

-- 8. Biodiversity Reports
CREATE TABLE biodiversity_reports (
    record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    researcher_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    species_name VARCHAR(100) NOT NULL,
    observation TEXT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    image TEXT,
    observed_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 9. Weather Alerts
CREATE TABLE weather_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    alert_type alert_type NOT NULL,
    severity severity_level NOT NULL DEFAULT 'Medium',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    radius_km DECIMAL(6,2),
    issued_time TIMESTAMP NOT NULL DEFAULT NOW(),
    expiry_time TIMESTAMP
);

-- 10. Notifications
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50) NULL, -- 'PollutionReport', 'Campaign', 'WeatherAlert'
    reference_id UUID NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. Report Updates
CREATE TABLE report_updates (
    update_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pollution_reports(report_id) ON DELETE CASCADE,
    updated_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    old_status report_status,
    new_status report_status,
    remarks TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. AI Predictions (AI Modules 1 & 2 Output)
CREATE TABLE ai_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pollution_reports(report_id) ON DELETE CASCADE,
    detected_object VARCHAR(100) NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    bounding_box JSONB NULL,
    predicted_severity severity_level,
    model_name VARCHAR(100) NOT NULL DEFAULT 'YOLOv8',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. AI Chat Messages (AI Module 4)
CREATE TABLE ai_chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    sender_type sender_type NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 14. IoT Devices
CREATE TABLE iot_devices (
    device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name VARCHAR(100) NOT NULL,
    device_type device_type NOT NULL,
    location_name VARCHAR(150),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    installed_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 15. Sensor Readings
CREATE TABLE sensor_readings (
    reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,
    ph DECIMAL(4,2) NULL,
    turbidity DECIMAL(6,2) NULL,
    bin_fill_level INT NULL,
    temperature DECIMAL(5,2) NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 16. Certificates
CREATE TABLE certificates (
    certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES cleanup_campaigns(campaign_id) ON DELETE CASCADE,
    certificate_url TEXT NOT NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 17. Payments
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES cleanup_campaigns(campaign_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'Pending',
    payment_method VARCHAR(50),
    transaction_ref VARCHAR(100),
    payment_date TIMESTAMP NULL
);

-- 18. System Announcements (TerraMarine System Admin)
CREATE TABLE system_announcements (
    announcement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(50) DEFAULT 'Info',
    target_role VARCHAR(50) DEFAULT 'All',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- 19. System Audit Logs (TerraMarine System Security)
CREATE TABLE system_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 20. Platform Settings & Configuration
CREATE TABLE platform_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 21. Database Backup & Disaster Recovery Snapshots
CREATE TABLE database_backups (
    backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    size_mb DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Completed',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- 22. Technical Support Helpdesk Tickets
CREATE TABLE support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(150) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'Open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);

-- -------------------------------------------------------------
-- 3. Indexes for Optimized Queries
-- -------------------------------------------------------------
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_reports_reported_by ON pollution_reports(reported_by);
CREATE INDEX idx_reports_status ON pollution_reports(status);
CREATE INDEX idx_campaigns_date ON cleanup_campaigns(campaign_date);
CREATE INDEX idx_tasks_status ON cleanup_tasks(status);
CREATE INDEX idx_sensor_device_recorded ON sensor_readings(device_id, recorded_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
