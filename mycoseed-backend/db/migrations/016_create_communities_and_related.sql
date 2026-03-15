-- ============================================
-- 社区与管理员：communities, community_members, community_join_requests, announcements, system_admins
-- ============================================

-- 1. 系统管理员表（最多 5 人，应用层校验）
CREATE TABLE IF NOT EXISTS system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_admins_user_id ON system_admins(user_id);
COMMENT ON TABLE system_admins IS '系统管理员表，最多5人，可创建社区并指定总管理员';

-- 2. 社区主表
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    markdown_intro TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    point_name VARCHAR(50) DEFAULT '积分',
    super_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_super_admin_id ON communities(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_communities_is_public ON communities(is_public);
COMMENT ON TABLE communities IS '社区主表';
COMMENT ON COLUMN communities.slug IS '英文/拼音，作邀请码，唯一';

DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. 社区成员与角色（member / sub_admin / super_admin）
CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'sub_admin', 'super_admin')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
COMMENT ON TABLE community_members IS '社区成员与角色，单表不区分管理员';

-- 4. 私有社区入群申请
CREATE TABLE IF NOT EXISTS community_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_join_requests_community_status ON community_join_requests(community_id, status);
COMMENT ON TABLE community_join_requests IS '私有社区入群申请';

-- 5. 公告（按社区）
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_community_id ON announcements(community_id);
DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
