// Mock 显示工具函数
export const formatAddress = (address: string) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export const displayBalance = (balance: bigint, decimals = 4, tokenDecimals = 18) => {
  const divisor = BigInt(10 ** tokenDecimals)
  const integerPart = balance / divisor
  const fractionalPart = balance % divisor
  
  if (fractionalPart === 0n) {
    return integerPart.toString()
  }
  
  const fractionalStr = fractionalPart.toString().padStart(tokenDecimals, '0')
  const trimmedFractional = fractionalStr.slice(0, decimals).replace(/0+$/, '')
  
  if (trimmedFractional === '') {
    return integerPart.toString()
  }
  
  return `${integerPart}.${trimmedFractional}`
}

/**
 * 根据积分名称获取缩写
 */
export const getPointAbbr = (pointName: string | undefined): string => {
  if (!pointName) return 'PTS'
  if (pointName === '零废弃积分') return 'ZWP'
  if (pointName === '南塘豆') return 'NTD'
  return 'PTS'
}

/**
 * 根据任务获取对应的积分符号
 * @param task 任务对象
 * @param communities 社区列表（可选，如果不提供会从API获取）
 * @param baseUrl API 基础 URL（可选，如果不提供会从环境变量读取）
 */
export const getTaskRewardSymbol = async (task: any, communities?: any[], baseUrl?: string): Promise<string> => {
  try {
    const { getMemberById, getCommunities, getApiBaseUrl } = await import('./api')
    
    // 如果任务没有创建者ID，直接返回默认值
    if (!task?.creatorId) {
      return '积分'
    }
    
    // 如果没有提供 baseUrl，从环境变量读取
    if (!baseUrl) {
      baseUrl = getApiBaseUrl()
    }
    
    // 获取任务创建者的信息
    const creator = await getMemberById(task.creatorId, baseUrl)
    
    // 如果无法获取创建者信息或创建者没有社区，返回默认值
    // 注意：当前数据库中没有社区表，所以 communities 为空数组是正常的
    if (!creator || !creator.communities || creator.communities.length === 0) {
      return '积分' // 默认显示"积分"
    }
    
    // 获取社区列表（如果未提供）
    let communityList = communities
    if (!communityList) {
      communityList = await getCommunities()
    }
    
    // 找到创建者所属的第一个社区
    const community = communityList.find(c => creator.communities.includes(c.id))
    if (community && community.pointName) {
      return getPointAbbr(community.pointName)
    }
    
    return '积分'
  } catch (error) {
    // 静默处理错误，返回默认值
    console.error('Failed to get task reward symbol:', error)
    return '积分'
  }
}
