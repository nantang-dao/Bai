-- 社区活动：日历标签、活动主体、子选项、期次、报名

CREATE TABLE IF NOT EXISTS community_calendar_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#64748b',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cct_community ON community_calendar_tags(community_id);

CREATE TABLE IF NOT EXISTS community_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('single', 'composite', 'pack')),
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tag_id UUID REFERENCES community_calendar_tags(id) ON DELETE SET NULL,
    note_enabled BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    registration_start TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_end TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 报名付费时 Semi 转账目标（可与发布人不同）
    payment_address VARCHAR(256) NOT NULL DEFAULT '',
    pack_frequency VARCHAR(20) CHECK (pack_frequency IS NULL OR pack_frequency IN ('daily', 'weekly', 'custom')),
    pack_custom_weekdays SMALLINT[],
    pack_range_start DATE,
    pack_range_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ce_community ON community_events(community_id);
CREATE INDEX IF NOT EXISTS idx_ce_pinned ON community_events(community_id, is_pinned);

DROP TRIGGER IF EXISTS update_ce_updated_at ON community_events;
CREATE TRIGGER update_ce_updated_at
    BEFORE UPDATE ON community_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS community_event_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT '',
    price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ceo_event ON community_event_options(event_id);

CREATE TABLE IF NOT EXISTS community_event_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
    sequence_no INT NOT NULL,
    activity_start TIMESTAMP WITH TIME ZONE NOT NULL,
    activity_end TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(event_id, sequence_no)
);
CREATE INDEX IF NOT EXISTS idx_ceo_ev ON community_event_occurrences(event_id);

CREATE TABLE IF NOT EXISTS community_event_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES community_event_occurrences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES community_event_options(id) ON DELETE SET NULL,
    remark TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(occurrence_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cep_occ ON community_event_participations(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_cep_user ON community_event_participations(user_id);

-- 默认日历标签
INSERT INTO community_calendar_tags (community_id, name, color_hex, sort_order)
SELECT c.id, t.name, t.color, t.ord
FROM communities c
CROSS JOIN (
    VALUES
        (0, '户外', '#22c55e'),
        (1, '室内', '#3b82f6'),
        (2, '讲座', '#a855f7'),
        (3, '聚会', '#eab308')
) AS t(ord, name, color)
ON CONFLICT (community_id, name) DO NOTHING;
