-- ==============================================================================
-- Seed Script: 20 Official Student Election Positions
-- Master Prompt Section 18
-- ==============================================================================

INSERT INTO positions (name, description, display_order, is_active) VALUES
('President', 'Executive leader of the Student Union Government.', 1, TRUE),
('Vice President', 'Assists the President and oversees committee operations.', 2, TRUE),
('Secretary General', 'Chief administrator and custodian of official union records.', 3, TRUE),
('Assistant Secretary General', 'Assists the Secretary General with administrative affairs.', 4, TRUE),
('Financial Secretary', 'Oversees financial documentation, accounts, and budgeting.', 5, TRUE),
('Treasurer', 'Manages disbursements, funds, and financial transactions.', 6, TRUE),
('Academic Director', 'Oversees academic support initiatives and student advocacy.', 7, TRUE),
('Assistant Academic Director', 'Assists in academic programs and tutorial coordination.', 8, TRUE),
('Software Director', 'Directs software innovations, developer affairs, and technical workshops.', 9, TRUE),
('Assistant Software Director', 'Assists the Software Director in technical workshops and projects.', 10, TRUE),
('Welfare Director', 'Manages student welfare, living conditions, and support services.', 11, TRUE),
('Assistant Welfare Director', 'Assists with campus welfare logistics and accommodations.', 12, TRUE),
('Social Director', 'Plans, organizes, and coordinates social campus events.', 13, TRUE),
('Assistant Social Director', 'Assists in campus social engagement and event coordination.', 14, TRUE),
('Sports Director', 'Organizes athletic competitions, tournaments, and recreational sports.', 15, TRUE),
('Assistant Sports Director', 'Assists with sporting facilities, fixtures, and teams.', 16, TRUE),
('Auditor General', 'Independent auditor of union finances, accounts, and inventories.', 17, TRUE),
('Public Relations Officer 1', 'Lead communications officer managing media and public relations.', 18, TRUE),
('Public Relations Officer 2', 'Assists with publications, press releases, and campus bulletins.', 19, TRUE),
('Sales Director', 'Manages student union merchandise, commercial booths, and sponsorships.', 20, TRUE)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;
