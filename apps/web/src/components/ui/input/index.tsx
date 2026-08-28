'use client'

import type { ComponentPropsWithRef } from 'react'

import { useFieldControl } from '@/components/ui/field'
import { cn } from '@/lib/ui/class-names'

const inputStyles =
  'w-full rounded-full border border-transparent bg-input px-6 py-4 font-sans text-base text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-text'

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input {...useFieldControl()} {...props} className={cn(inputStyles, className)} />
}
