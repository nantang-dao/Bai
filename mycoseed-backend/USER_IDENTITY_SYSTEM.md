# 用户身份系统说明

## 当前系统架构

### 1. 用户表结构（`users` 表）

当前数据库中的 `users` 表包含以下关键字段：

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,                    -- 用户唯一ID（UUID）
    phone VARCHAR(20) UNIQUE,               -- 手机号（唯一，主要身份标识）
    email VARCHAR(255) UNIQUE,              -- 邮箱（唯一，备用身份标识）
    handle VARCHAR(50) UNIQUE,              -- 用户名（唯一，可选）
    phone_verified BOOLEAN,                 -- 手机号是否已验证
    evm_chain_address VARCHAR(255),         -- 钱包地址（预留字段）
    evm_chain_active_key VARCHAR(255),      -- 钱包私钥（预留字段）
    encrypted_keys JSONB,                    -- 加密密钥（预留字段）
    ...
)
```

### 2. 当前身份验证流程

1. **用户注册/登录**：
   - 用户输入手机号
   - 系统发送短信验证码
   - 用户输入验证码
   - 系统验证后：
     - 如果用户不存在，**自动创建新用户**（基于手机号）
     - 如果用户已存在，**直接登录**（基于手机号查找）

2. **身份标识**：
   - **主要标识**：`phone`（手机号）- **唯一且必填**
   - **备用标识**：`email`（邮箱）- 唯一但可选
   - **用户ID**：`id`（UUID）- 系统内部使用

3. **钱包关联**（当前状态）：
   - 数据库中有 `evm_chain_address` 字段，但**目前未完全实现**
   - 前端有临时的硬编码映射表 `phoneToWalletMap`（仅用于开发测试）

---

## 对接新身份系统的建议方案

### 方案一：手机号作为唯一关联键（推荐）

**核心思路**：使用手机号作为两个系统之间的桥梁，确保同一手机号在两个系统中指向同一用户。

#### 实现步骤：

1. **保持现有系统不变**：
   - 继续使用 `phone` 作为主要身份标识
   - 保持 `users` 表结构基本不变

2. **添加新身份系统关联字段**：
   ```sql
   ALTER TABLE users 
   ADD COLUMN new_identity_system_id VARCHAR(255) UNIQUE,  -- 新身份系统的用户ID
   ADD COLUMN new_identity_system_phone VARCHAR(20),       -- 新身份系统的手机号（用于验证）
   ADD COLUMN identity_synced_at TIMESTAMP,               -- 同步时间
   ADD COLUMN identity_sync_status VARCHAR(20);          -- 同步状态：pending/synced/failed
   ```

3. **同步逻辑**：
   ```typescript
   // 伪代码示例
   async function syncWithNewIdentitySystem(phone: string) {
     // 1. 在新身份系统中查找该手机号
     const newSystemUser = await newIdentitySystem.findByPhone(phone)
     
     // 2. 如果找到，关联两个系统
     if (newSystemUser) {
       await updateUser(phone, {
         new_identity_system_id: newSystemUser.id,
         new_identity_system_phone: newSystemUser.phone,
         identity_synced_at: new Date(),
         identity_sync_status: 'synced'
       })
     }
     
     // 3. 如果新系统中没有，可以选择：
     //    - 在新系统中创建用户（自动同步）
     //    - 标记为待同步（手动处理）
   }
   ```

4. **登录流程更新**：
   ```typescript
   // 用户登录时
   1. 验证手机号和验证码（现有流程）
   2. 查找或创建用户（现有流程）
   3. 尝试同步到新身份系统（新增）
      - 如果新系统中有相同手机号 → 自动关联
      - 如果新系统中没有 → 标记为待同步或自动创建
   ```

#### 优势：
- ✅ **零冲突**：手机号是唯一标识，不会产生重复用户
- ✅ **向后兼容**：现有用户无需重新注册
- ✅ **渐进式迁移**：可以逐步迁移，不影响现有功能
- ✅ **数据一致性**：通过手机号确保两个系统的用户对应关系

---

### 方案二：邮箱作为备用关联键

如果新身份系统也支持邮箱登录，可以同时使用手机号和邮箱作为关联键：

```typescript
async function syncWithNewIdentitySystem(user: User) {
  // 优先使用手机号
  if (user.phone) {
    const newUser = await newIdentitySystem.findByPhone(user.phone)
    if (newUser) return linkUsers(user.id, newUser.id)
  }
  
  // 备用：使用邮箱
  if (user.email) {
    const newUser = await newIdentitySystem.findByEmail(user.email)
    if (newUser) return linkUsers(user.id, newUser.id)
  }
  
  // 如果都找不到，创建新用户或标记待同步
}
```

---

## 钱包系统对接

### 当前状态

1. **数据库字段已预留**：
   - `evm_chain_address`：钱包地址
   - `evm_chain_active_key`：钱包私钥（加密存储）
   - `encrypted_keys`：加密密钥（JSON格式）

2. **前端临时方案**：
   - 硬编码的 `phoneToWalletMap` 映射表
   - 仅用于开发测试，不是生产方案

### 对接建议

1. **钱包创建时机**：
   - 用户首次登录时自动创建钱包
   - 或者用户主动在设置中创建钱包

2. **钱包存储**：
   ```typescript
   // 创建钱包后
   await updateUser(userId, {
     evm_chain_address: walletAddress,
     evm_chain_active_key: encryptedPrivateKey,  // 必须加密存储！
     encrypted_keys: {
       algorithm: 'AES-256',
       // ... 其他加密信息
     }
   })
   ```

3. **钱包与新身份系统关联**：
   - 如果新身份系统也管理钱包，可以通过手机号关联
   - 确保两个系统的钱包地址一致，或建立映射关系

---

## 当前问题修复

### 问题：`getMemberById` 返回 null

**原因**：`getMemberById` 函数目前返回 `null`，导致 `getTaskRewardSymbol` 无法获取创建者信息。

**临时解决方案**：

修改 `mycoseed-frontend/utils/display.ts` 中的 `getTaskRewardSymbol` 函数，使其在无法获取创建者信息时使用默认值：

```typescript
export const getTaskRewardSymbol = async (task: any, communities?: any[]): Promise<string> => {
  try {
    const { getMemberById, getCommunities } = await import('./api')
    
    // 获取任务创建者的信息
    const creator = await getMemberById(task.creatorId)
    
    // 如果无法获取创建者信息，返回默认值
    if (!creator || !creator.communities || creator.communities.length === 0) {
      return '积分' // 默认显示"积分"
    }
    
    // ... 其余逻辑
  } catch (error) {
    console.error('Failed to get task reward symbol:', error)
    return '积分' // 错误时也返回默认值
  }
}
```

**长期解决方案**：

1. **实现后端成员 API**：
   - 在 `mycoseed-backend/src/controllers/` 中创建 `membersController.ts`
   - 实现 `getMemberById` 接口，返回用户信息和所属社区

2. **更新前端 API**：
   - 修改 `mycoseed-frontend/utils/api.ts` 中的 `getMemberById`
   - 调用后端 API 获取真实的用户数据

---

## 迁移检查清单

对接新身份系统时，请确认：

- [ ] 手机号在两个系统中保持一致
- [ ] 用户数据可以双向同步（现有系统 ↔ 新系统）
- [ ] 登录流程兼容新旧系统
- [ ] 钱包地址正确关联
- [ ] 用户权限和角色正确映射
- [ ] 数据迁移脚本已测试
- [ ] 回滚方案已准备

---

## 总结

**当前系统**：
- ✅ 使用手机号作为主要身份标识
- ✅ 用户表结构完善，已预留钱包和新系统字段
- ⚠️ 钱包系统尚未完全实现（仅前端有临时映射）
- ⚠️ 成员 API 尚未实现（导致 `getMemberById` 返回 null）

**对接新系统建议**：
- ✅ **使用手机号作为唯一关联键**，确保同一手机号在两个系统中指向同一用户
- ✅ 渐进式迁移，不影响现有功能
- ✅ 保持数据一致性，避免用户重复

**下一步行动**：
1. 修复 `getMemberById` 问题（实现后端成员 API 或使用临时方案）
2. 完善钱包系统实现
3. 设计新身份系统对接方案（基于手机号关联）
