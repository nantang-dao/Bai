-- 社区商城：标签、商品、图、评价（按社区隔离）

CREATE TABLE IF NOT EXISTS community_marketplace_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#64748b',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cmkt_community ON community_marketplace_tags(community_id);

CREATE TABLE IF NOT EXISTS community_marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'sold', 'withdrawn')),
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cml_community_status ON community_marketplace_listings(community_id, status);
CREATE INDEX IF NOT EXISTS idx_cml_seller ON community_marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_cml_created ON community_marketplace_listings(community_id, created_at DESC);

DROP TRIGGER IF EXISTS update_cml_updated_at ON community_marketplace_listings;
CREATE TRIGGER update_cml_updated_at
    BEFORE UPDATE ON community_marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS community_marketplace_listing_images (
    listing_id UUID NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
    sort_order SMALLINT NOT NULL CHECK (sort_order >= 0 AND sort_order < 3),
    image_url TEXT NOT NULL,
    PRIMARY KEY (listing_id, sort_order)
);

CREATE TABLE IF NOT EXISTS community_marketplace_listing_tags (
    listing_id UUID NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES community_marketplace_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_cmlt_tag ON community_marketplace_listing_tags(tag_id);

CREATE TABLE IF NOT EXISTS community_marketplace_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 0 AND rating <= 5),
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(listing_id)
);
CREATE INDEX IF NOT EXISTS idx_cmrev_community_created ON community_marketplace_reviews(community_id, created_at DESC);

-- 为已有社区插入默认四个标签
INSERT INTO community_marketplace_tags (community_id, name, color_hex, sort_order)
SELECT c.id, t.name, t.color, t.ord
FROM communities c
CROSS JOIN (
    VALUES
        (0, '闲置物品', '#f87171'),
        (1, '技能服务', '#3b82f6'),
        (2, '代购跑腿', '#eab308'),
        (3, '珍藏好物', '#a855f7')
) AS t(ord, name, color)
ON CONFLICT (community_id, name) DO NOTHING;
