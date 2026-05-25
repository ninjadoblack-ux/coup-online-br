
import { createFileRoute } from '@tanstack/react-router'
import { GameContainer } from '@/components/GameContainer'

export const Route = createFileRoute('/')({
  component: () => (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-purple-500/30">
      <GameContainer />
    </div>
  ),
})
