import {
  BookOpen,
  Braces,
  BriefcaseBusiness,
  Folder,
  Globe2,
  GraduationCap,
  Heart,
  Palette,
  Terminal,
  Wrench
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const projectIconOptions: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'braces', label: '代码', icon: Braces },
  { id: 'folder', label: '文件夹', icon: Folder },
  { id: 'terminal', label: '终端', icon: Terminal },
  { id: 'book', label: '文档', icon: BookOpen },
  { id: 'study', label: '学习', icon: GraduationCap },
  { id: 'design', label: '设计', icon: Palette },
  { id: 'work', label: '工作', icon: BriefcaseBusiness },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'heart', label: '收藏', icon: Heart },
  { id: 'web', label: '网站', icon: Globe2 }
]

export const projectColorOptions = [
  '#34363a', '#ef4444', '#f97316', '#f5b800',
  '#16a34a', '#1687f8', '#8b5cf6', '#ec4899'
]

export function ProjectGlyph({ icon = 'braces', color }: { icon?: string; color?: string }) {
  const Icon = projectIconOptions.find((item) => item.id === icon)?.icon ?? Braces
  return <Icon aria-hidden="true" style={color ? { color } : undefined} />
}
