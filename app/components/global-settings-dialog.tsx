"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { GlobalSettings } from "../types"

interface GlobalSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: GlobalSettings
  onUpdateSettings: (settings: GlobalSettings) => void
}

export default function GlobalSettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
}: GlobalSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState(settings)

  const handleSave = () => {
    onUpdateSettings(localSettings)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Global Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="useGlobal"
              checked={localSettings.useGlobalGoals}
              onCheckedChange={(checked) => setLocalSettings({ ...localSettings, useGlobalGoals: checked as boolean })}
            />
            <Label htmlFor="useGlobal">Use global default goals for all stacks</Label>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultTime">Default Time Goal (minutes)</Label>
              <Input
                id="defaultTime"
                type="number"
                value={localSettings.defaultTimeGoal}
                onChange={(e) => setLocalSettings({ ...localSettings, defaultTimeGoal: Number(e.target.value) })}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultWords">Default Words Goal</Label>
              <Input
                id="defaultWords"
                type="number"
                value={localSettings.defaultWordsGoal}
                onChange={(e) => setLocalSettings({ ...localSettings, defaultWordsGoal: Number(e.target.value) })}
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
