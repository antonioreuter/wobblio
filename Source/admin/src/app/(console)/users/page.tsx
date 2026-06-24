'use client'

import { Users } from 'lucide-react'
import { ConsoleSection } from '@/components/ui/console-section/console-section'
import { UsersSection } from './users-section'

export default function UsersPage() {
  return (
    <ConsoleSection
      id="users"
      icon={Users}
      title="User Quota Management"
      description="Search users and adjust their weekly upload quotas."
    >
      <UsersSection />
    </ConsoleSection>
  )
}
