import React from 'react'
import { 
  ShoppingBag, 
  ShoppingCart, 
  Tag, 
  Coins, 
  Coffee, 
  Flame, 
  UtensilsCrossed, 
  Receipt 
} from 'lucide-react'

const merchantConfigs: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; initials: string }
> = {
  "albert heijn": { icon: ShoppingBag, color: "bg-[#00a1e2] text-white", initials: "AH" },
  "albert heijn xl": { icon: ShoppingBag, color: "bg-[#00a1e2] text-white", initials: "AH" },
  "ah to go": { icon: Coffee, color: "bg-[#00a1e2] text-white", initials: "AH" },
  "jumbo": { icon: ShoppingCart, color: "bg-[#f59e0b] text-[#0f172a]", initials: "J" },
  "jumbo oostpoort": { icon: ShoppingCart, color: "bg-[#f59e0b] text-[#0f172a]", initials: "J" },
  "dirk": { icon: Tag, color: "bg-[#ef4444] text-white", initials: "D" },
  "dirk van den broek": { icon: Tag, color: "bg-[#ef4444] text-white", initials: "D" },
  "lidl": { icon: Coins, color: "bg-[#8b5cf6] text-white", initials: "L" },
  "tokomania": { icon: Flame, color: "bg-[#10b981] text-white", initials: "TK" },
  "restaurante cantinho": { icon: UtensilsCrossed, color: "bg-[#be123c] text-white", initials: "RC" }
}

export function MerchantIcon({ merchantName, className = "h-8 w-8 text-xs" }: { merchantName: string; className?: string }) {
  const normName = merchantName.toLowerCase().trim()
  
  // Find match by exact match or startsWith
  const key = Object.keys(merchantConfigs).find(k => normName.startsWith(k))
  const config = key ? merchantConfigs[key] : { icon: Receipt, color: "bg-slate-500 text-white", initials: "?" }
  
  const IconComponent = config.icon

  return (
    <div className={`flex items-center justify-center rounded-[8px] font-bold ${config.color} ${className}`} title={merchantName}>
      <IconComponent className="h-[55%] w-[55%] stroke-[2]" />
    </div>
  )
}
