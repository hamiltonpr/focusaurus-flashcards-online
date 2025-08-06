"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Stack } from "../types"

interface CreateStackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateStack: (stack: Stack) => void
}

export default function CreateStackDialog({ open, onOpenChange, onCreateStack }: CreateStackDialogProps) {
  const [stackName, setStackName] = useState("")

  const handleCreate = () => {
    if (stackName.trim()) {
      const newStack: Stack = {
        id: Date.now().toString(),
        name: stackName.trim(),
        cards: [],
        todayStats: { wordsStudied: 0, timeSpent: 0, accuracy: 0 },
      }
      onCreateStack(newStack)
      setStackName("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Stack</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stackName">Stack Name</Label>
            <Input
              id="stackName"
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              placeholder="e.g., Spanish Vocabulary"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!stackName.trim()}>
              Create Stack
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
