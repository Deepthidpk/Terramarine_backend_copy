-- TerraMarine Seed Data
-- Inserts initial records with fixed UUIDs for referential consistency

-- Password hash for 'password123' (bcrypt round 10)
-- Hash: $2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i

-- -------------------------------------------------------------
-- 1. Insert Users
-- -------------------------------------------------------------
INSERT INTO users (
    user_id, full_name, email, phone, password_hash, role, organization_name, profile_image, address, district, state, status,
    registration_number, organization_address, registration_certificate_url,
    institution_name, department, research_area, institution_id_url,
    government_id_type, government_id_number, government_id_url,
    fishing_license_number, boat_registration_number
) VALUES
('11111111-1111-1111-1111-111111111111', 'John Citizen', 'citizen@terramarine.com', '+919876543210', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Citizen', NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde', '12 Beach Road', 'Ernakulam', 'Kerala', 'Active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('22222222-2222-2222-2222-222222222222', 'Captain Jack', 'fisherman@terramarine.com', '+919876543211', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Fisherman', NULL, 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61', 'Harbour Quarters', 'Ernakulam', 'Kerala', 'Active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'LIC-100223', 'BOAT-IND-9922'),
('33333333-3333-3333-3333-333333333333', 'Eco Waves NGO', 'ngo@terramarine.com', '+919876543212', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'NGO', 'Eco Waves Coastal NGO', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', 'Green Office, Marine Drive', 'Ernakulam', 'Kerala', 'Active', 'REG-NGO-998822', 'Green Office, Marine Drive, Kochi', '/api/admin/documents/sample_cert.pdf', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('44444444-4444-4444-4444-444444444444', 'Municipal Authority', 'authority@terramarine.com', '+919876543213', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Authority', 'Kochi Municipal Corporation', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7', 'Corporation Building', 'Ernakulam', 'Kerala', 'Active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('55555555-5555-5555-5555-555555555555', 'Alex Green', 'volunteer@terramarine.com', '+919876543214', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Volunteer', NULL, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 'Lighthouse Lane', 'Ernakulam', 'Kerala', 'Active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Aadhaar', '9988-7766-5544', '/api/admin/documents/sample_id.pdf', NULL, NULL),
('66666666-6666-6666-6666-666666666666', 'Dr. Sarah Stone', 'researcher@terramarine.com', '+919876543215', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Researcher', 'Marine Biology Institute', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 'Research Campus', 'Ernakulam', 'Kerala', 'Active', NULL, NULL, NULL, 'Marine Biology Institute', 'Oceanography', 'Coastal Pollution and Biodiversity', '/api/admin/documents/sample_researcher_id.pdf', NULL, NULL, NULL, NULL, NULL),
('77777777-7777-7777-7777-777777777777', 'System Admin', 'terramarine33@gmail.com', '+919876543216', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Admin', NULL, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 'Main Server Control Room', 'Ernakulam', 'Kerala', 'Active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
-- Pending NGO for verification testing
('88888888-8888-8888-8888-888888888888', 'Save The Oceans NGO', 'pending-ngo@terramarine.com', '+919876543217', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'NGO', 'Save The Oceans', 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e', '45 Beach Walk', 'Ernakulam', 'Kerala', 'Pending', 'REG-NGO-88888', '45 Beach Walk, Kochi', '/api/admin/documents/sample_cert.pdf', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
-- Pending Researcher for verification testing
('99999999-9999-9999-9999-999999999999', 'Dr. Alan Turing', 'pending-researcher@terramarine.com', '+919876543218', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Researcher', 'Cochin University', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', 'CUSAT Campus', 'Ernakulam', 'Kerala', 'Pending', NULL, NULL, NULL, 'Cochin University of Science and Technology', 'Computer Science & Environmental Modeling', 'AI Marine Pollution Detection', '/api/admin/documents/sample_researcher_id.pdf', NULL, NULL, NULL, NULL, NULL),
-- Suspended Citizen
('aaaaaaaa-1111-bbbb-2222-cccccccccccc', 'Suspended User', 'suspended@terramarine.com', '+919876543219', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'Citizen', NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde', 'Suspended Lane', 'Ernakulam', 'Kerala', 'Suspended', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
-- Rejected NGO
('bbbbbbbb-1111-cccc-2222-dddddddddddd', 'Rejected NGO', 'rejected@terramarine.com', '+919876543220', '$2a$10$mC195CHb6Hd7FqAGYzW2peU9W1Oq7JhyQ0H4/o3q1qO1Pz.5YtS.i', 'NGO', 'Rejected Oceans NGO', 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e', 'Rejected Lane', 'Ernakulam', 'Kerala', 'Rejected', 'REG-NGO-rejected', 'Rejected Lane 10', '/api/admin/documents/sample_cert.pdf', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- -------------------------------------------------------------
-- 2. Insert Pollution Reports
-- -------------------------------------------------------------
INSERT INTO pollution_reports (report_id, reported_by, report_category, title, description, image_url, latitude, longitude, location_name, waste_type, severity, status, reported_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Pollution', 'Heavy Plastic Bottles Accumulated', 'A large amount of single-use plastic bottles, containers, and food wrappers have washed ashore near the walkway.', 'https://images.unsplash.com/photo-1618477388954-7852f32655ec', 9.9760000, 76.2750000, 'Fort Kochi Beach', 'Plastic', 'High', 'Pending', NOW() - INTERVAL '5 days'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Emergency', 'Oil Spill Detected Near Harbour', 'A thick oil slick is visible extending from the docking area outward. Smells strong and covers marine life.', 'https://images.unsplash.com/photo-1621451537084-482c73023701', 9.9670000, 76.2620000, 'Kochi Fishing Harbour', 'Oil Spill', 'High', 'Verified', NOW() - INTERVAL '2 days'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Pollution', 'Discarded Fishing Nets', 'Abandoned nylon ghost nets entangled around the rocks along the shoreline, endangering birds and crabs.', 'https://images.unsplash.com/photo-1530587191325-3db32d826c18', 9.9820000, 76.2800000, 'Vypin Beach Walkway', 'Fishing Nets', 'Medium', 'Completed', NOW() - INTERVAL '10 days');

-- -------------------------------------------------------------
-- 3. Insert Cleanup Campaigns
-- -------------------------------------------------------------
INSERT INTO cleanup_campaigns (campaign_id, created_by, campaign_name, description, campaign_date, start_time, end_time, location, latitude, longitude, maximum_volunteers, status, created_at) VALUES
('11112222-3333-4444-5555-666677778888', '33333333-3333-3333-3333-333333333333', 'Mega Fort Kochi Beach Cleanup Drive', 'Join Eco Waves NGO and volunteers to clean up accumulated plastic bottles and general litter from Fort Kochi shoreline. Refreshments and certificates will be provided.', CURRENT_DATE + INTERVAL '5 days', '07:30:00', '11:00:00', 'Fort Kochi Beach Walkway', 9.9760000, 76.2750000, 50, 'Upcoming', NOW() - INTERVAL '1 day'),
('22223333-4444-5555-6666-777788889999', '33333333-3333-3333-3333-333333333333', 'Vypin Shoreline Restoration', 'Community initiative to clean up ghost nets and plastic litter along Vypin beach rocks.', CURRENT_DATE - INTERVAL '2 days', '08:00:00', '12:00:00', 'Vypin Beach Walkway', 9.9820000, 76.2800000, 30, 'Completed', NOW() - INTERVAL '8 days');

-- -------------------------------------------------------------
-- 4. Insert Campaign Volunteers
-- -------------------------------------------------------------
INSERT INTO campaign_volunteers (campaign_id, volunteer_id, joined_date, attendance, certificate_status) VALUES
('11112222-3333-4444-5555-666677778888', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '12 hours', FALSE, FALSE),
('11112222-3333-4444-5555-666677778888', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '10 hours', FALSE, FALSE),
('22223333-4444-5555-6666-777788889999', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '9 days', TRUE, TRUE);

-- -------------------------------------------------------------
-- 5. Insert Cleanup Tasks
-- -------------------------------------------------------------
INSERT INTO cleanup_tasks (task_id, report_id, campaign_id, assigned_worker, assigned_date, deadline, status, before_image, after_image, completion_notes, completed_date) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11112222-3333-4444-5555-666677778888', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days', 'Pending', 'https://images.unsplash.com/photo-1618477388954-7852f32655ec', NULL, NULL, NULL),
('eeeeeeee-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22223333-4444-5555-6666-777788889999', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '8 days', CURRENT_DATE - INTERVAL '2 days', 'Verified', 'https://images.unsplash.com/photo-1530587191325-3db32d826c18', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e', 'Cleaned all the ghost nets and plastic litter along the rocks successfully.', NOW() - INTERVAL '2 days');

-- -------------------------------------------------------------
-- 6. Insert Weather Alerts
-- -------------------------------------------------------------
INSERT INTO weather_alerts (alert_id, issued_by, title, description, alert_type, severity, latitude, longitude, radius_km, expiry_time) VALUES
('3333aaaa-bbbb-cccc-dddd-eeeeffffffff', '44444444-4444-4444-4444-444444444444', 'Heavy Sea Roughness Advisory', 'Fishermen are advised not to venture into deep sea for the next 24 hours due to strong westerly winds speeds reaching 45-55 kmph and high waves.', 'Marine', 'High', 9.9670000, 76.2620000, 25.00, NOW() + INTERVAL '1 day');

-- -------------------------------------------------------------
-- 7. Insert Biodiversity Reports
-- -------------------------------------------------------------
INSERT INTO biodiversity_reports (record_id, researcher_id, species_name, observation, latitude, longitude, image, observed_date) VALUES
('8888aaaa-bbbb-cccc-dddd-eeeeffffffff', '66666666-6666-6666-6666-666666666666', 'Indian Humpback Dolphin', 'A group of three dolphins spotted swimming close to the Fort Kochi shoreline. Behaved normally, heading north.', 9.9700000, 76.2600000, 'https://images.unsplash.com/photo-1570481662006-a3a1374699e8', CURRENT_DATE - INTERVAL '1 day');

-- -------------------------------------------------------------
-- 8. Insert IoT Devices
-- -------------------------------------------------------------
INSERT INTO iot_devices (device_id, device_name, device_type, location_name, latitude, longitude, status, installed_date) VALUES
('11119999-8888-7777-6666-555544443333', 'Fort Kochi Beach Smart Bin A1', 'WasteBin', 'Near Fort Kochi Promenade', 9.9763000, 76.2753000, 'Active', CURRENT_DATE - INTERVAL '30 days'),
('22229999-8888-7777-6666-555544443333', 'Vypin Harbour Water Quality Node W1', 'WaterQuality', 'Harbour Entrance Channel', 9.9675000, 76.2625000, 'Active', CURRENT_DATE - INTERVAL '15 days');

-- -------------------------------------------------------------
-- 9. Insert Sensor Readings
-- -------------------------------------------------------------
INSERT INTO sensor_readings (reading_id, device_id, ph, turbidity, bin_fill_level, temperature, recorded_at) VALUES
(gen_random_uuid(), '11119999-8888-7777-6666-555544443333', NULL, NULL, 30, 29.5, NOW() - INTERVAL '2 hours'),
(gen_random_uuid(), '11119999-8888-7777-6666-555544443333', NULL, NULL, 65, 30.1, NOW() - INTERVAL '1 hour'),
(gen_random_uuid(), '11119999-8888-7777-6666-555544443333', NULL, NULL, 85, 29.8, NOW()),
(gen_random_uuid(), '22229999-8888-7777-6666-555544443333', 7.82, 12.4, NULL, 28.2, NOW() - INTERVAL '2 hours'),
(gen_random_uuid(), '22229999-8888-7777-6666-555544443333', 7.79, 14.1, NULL, 28.5, NOW() - INTERVAL '1 hour'),
(gen_random_uuid(), '22229999-8888-7777-6666-555544443333', 7.42, 28.6, NULL, 28.9, NOW()); -- higher turbidity (potential runoff/pollution)

-- -------------------------------------------------------------
-- 10. Insert Certificates
-- -------------------------------------------------------------
INSERT INTO certificates (certificate_id, volunteer_id, campaign_id, certificate_url, issued_date) VALUES
('6666bbbb-cccc-dddd-eeee-ffffffffffff', '55555555-5555-5555-5555-555555555555', '22223333-4444-5555-6666-777788889999', 'certificates/cert_vypin_alex.pdf', CURRENT_DATE - INTERVAL '2 days');

-- -------------------------------------------------------------
-- 11. Insert Payments
-- -------------------------------------------------------------
INSERT INTO payments (payment_id, volunteer_id, campaign_id, amount, payment_status, payment_method, transaction_ref, payment_date) VALUES
('7777bbbb-cccc-dddd-eeee-ffffffffffff', '55555555-5555-5555-5555-555555555555', '22223333-4444-5555-6666-777788889999', 500.00, 'Paid', 'UPI', 'TXN9928374829', NOW() - INTERVAL '2 days');

-- -------------------------------------------------------------
-- 12. Insert Notifications
-- -------------------------------------------------------------
INSERT INTO notifications (notification_id, user_id, title, message, reference_type, reference_id, is_read, created_at) VALUES
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'New Cleanup Task Assigned', 'You have been assigned a cleanup task for Fort Kochi Beach.', 'PollutionReport', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', FALSE, NOW() - INTERVAL '1 day'),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Severe Weather Alert Issued', 'Heavy Sea Roughness Advisory has been issued for your location.', 'WeatherAlert', '3333aaaa-bbbb-cccc-dddd-eeeeffffffff', FALSE, NOW() - INTERVAL '12 hours');
