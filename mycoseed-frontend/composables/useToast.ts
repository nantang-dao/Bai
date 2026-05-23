// useToast composable for Nuxt 3
// @nuxt/ui provides useToast automatically, but we provide a fallback
export const useToast = () => {
  return {
    add: (options: { title: string; description?: string; color?: string }) => {
      // Simple console fallback - in production you might want to use @nuxt/ui's toast
      if (process.client) {
        console.log('Toast:', options.title, options.description || '')
        // TODO: Implement actual toast UI using @nuxt/ui or a custom component
      }
    }
  }
}

