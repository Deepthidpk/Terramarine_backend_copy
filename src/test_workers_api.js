const db = require('./config/db');

async function test() {
  const query = `
    SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.organization_name, u.address, 
           u.district, u.state, u.status, u.created_at, u.registration_number, 
           u.organization_address, u.registration_certificate_url, u.institution_name, 
           u.department, u.research_area, u.institution_id_url, u.government_id_type, 
           u.government_id_number, u.government_id_url, u.fishing_license_number, 
           u.boat_registration_number,
           (
             SELECT COUNT(*)::int
             FROM cleanup_tasks t
             WHERE t.status IN ('Pending', 'In Progress')
               AND t.assigned_worker ILIKE '%' || u.user_id::text || '%'
           ) as active_tasks_count,
           (
             SELECT string_agg(DISTINCT date_val, ', ')
             FROM (
               SELECT TO_CHAR(t.deadline, 'YYYY-MM-DD') as date_val
               FROM cleanup_tasks t
               WHERE t.status IN ('Pending', 'In Progress')
                 AND t.assigned_worker ILIKE '%' || u.user_id::text || '%'
                 AND t.deadline IS NOT NULL
               UNION
               SELECT TO_CHAR(t.assigned_date, 'YYYY-MM-DD') as date_val
               FROM cleanup_tasks t
               WHERE t.status IN ('Pending', 'In Progress')
                 AND t.assigned_worker ILIKE '%' || u.user_id::text || '%'
                 AND t.assigned_date IS NOT NULL
             ) dates_sub
           ) as busy_dates,
           (
             SELECT string_agg(DISTINCT r.title || ' (' || COALESCE(TO_CHAR(t.deadline, 'YYYY-MM-DD'), TO_CHAR(t.assigned_date, 'YYYY-MM-DD')) || ')', '; ')
             FROM cleanup_tasks t
             JOIN pollution_reports r ON t.report_id = r.report_id
             WHERE t.status IN ('Pending', 'In Progress')
               AND t.assigned_worker ILIKE '%' || u.user_id::text || '%'
           ) as active_task_names
    FROM users u
    WHERE u.role NOT IN ('Admin', 'Authority') AND u.role = 'Worker'
  `;

  const res = await db.query(query);
  console.log('WORKERS API RESPONSE:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
