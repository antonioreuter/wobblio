'use client'

import { ShoppingCart, Home, Smile, Heart, PawPrint, UtensilsCrossed, Car, Shirt, Laptop, Stethoscope, Leaf, Film, Wrench, Building2, Wine, Hammer, Tag, type LucideIcon } from 'lucide-react'

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'cat-groceries': ShoppingCart,
  'cat-household': Home,
  'cat-personal-care': Smile,
  'cat-baby': Heart,
  'cat-pet': PawPrint,
  'cat-dining-out': UtensilsCrossed,
  'cat-transport': Car,
  'cat-clothing': Shirt,
  'cat-electronics': Laptop,
  'cat-health': Stethoscope,
  'cat-home-garden': Leaf,
  'cat-entertainment': Film,
  'cat-services': Wrench,
  'cat-lodging': Building2,
  'cat-bars-pubs': Wine,
  'cat-hardware': Hammer,
  'cat-other': Tag,
}

// Resolve sub-categories to macro category ID
const CATEGORY_PARENTS: Record<string, string> = {
  'cat-dairy': 'cat-groceries',
  'cat-cheese': 'cat-groceries',
  'cat-produce': 'cat-groceries',
  'cat-meat-fish': 'cat-groceries',
  'cat-bakery': 'cat-groceries',
  'cat-breakfast': 'cat-groceries',
  'cat-baking': 'cat-groceries',
  'cat-grains': 'cat-groceries',
  'cat-canned': 'cat-groceries',
  'cat-condiments': 'cat-groceries',
  'cat-frozen': 'cat-groceries',
  'cat-beverages': 'cat-groceries',
  'cat-coffee-tea': 'cat-groceries',
  'cat-alcohol': 'cat-groceries',
  'cat-snacks': 'cat-groceries',
  'cat-nuts': 'cat-groceries',
  'cat-ready-deli': 'cat-groceries',
  'cat-pharmacy': 'cat-personal-care',
  'cat-vitamins': 'cat-personal-care',
  'cat-skincare': 'cat-personal-care',
  'cat-haircare': 'cat-personal-care',
  'cat-cosmetics': 'cat-personal-care',
  'cat-oralcare': 'cat-personal-care',
  'cat-cleaning-supplies': 'cat-household',
  'cat-paper-goods': 'cat-household',
  'cat-kitchen-storage': 'cat-household',
  'cat-furniture': 'cat-home-garden',
  'cat-tools-diy': 'cat-home-garden',
  'cat-garden': 'cat-home-garden',
  'cat-medical': 'cat-health',
  'cat-fitness': 'cat-health',
  'cat-optical': 'cat-health',
  'cat-special-diet': 'cat-groceries',
  'cat-personal-accessories': 'cat-clothing',
  'cat-books': 'cat-entertainment',
  'cat-games': 'cat-entertainment',
  'cat-sports': 'cat-entertainment',
  'cat-hobbies': 'cat-entertainment',
  'cat-music': 'cat-entertainment',
}

function getMacroCategoryId(categoryId: string): string {
  return CATEGORY_PARENTS[categoryId] ?? categoryId
}

export interface CategoryIconProps {
  categoryId: string | null | undefined
  size?: number
  className?: string
}

export function CategoryIcon({ categoryId, size = 16, className = '' }: CategoryIconProps) {
  if (!categoryId) return <Tag size={size} className={className} />

  const macroId = getMacroCategoryId(categoryId)
  const IconComponent = CATEGORY_ICON_MAP[macroId] ?? Tag

  return <IconComponent size={size} className={className} />
}
