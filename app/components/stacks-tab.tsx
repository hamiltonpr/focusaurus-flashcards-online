"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Settings, Upload } from "lucide-react"
import type { Stack, GlobalSettings } from "../types"
import CreateStackDialog from "./create-stack-dialog"
import ImportCSVDialog from "./import-csv-dialog"
import StackGoalPage from "./stack-goal-page"
import GlobalSettingsDialog from "./global-settings-dialog"

interface StacksTabProps {
  stacks: Stack[]
  setStacks: (stacks: Stack[]) => void
  globalSettings: GlobalSettings
  setGlobalSettings: (settings: GlobalSettings) => void
}

export default function StacksTab({ stacks, setStacks, globalSettings, setGlobalSettings }: StacksTabProps) {
  const [selectedStack, setSelectedStack] = useState<Stack | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  if (selectedStack) {
    return (
      <StackGoalPage
        stack={selectedStack}
        onBack={() => setSelectedStack(null)}
        onUpdateStack={(updatedStack) => {
          setStacks(stacks.map((s) => (s.id === updatedStack.id ? updatedStack : s)))
          setSelectedStack(updatedStack)
        }}
        globalSettings={globalSettings}
      />
    )
  }

  const formatLastStudied = (dateString?: string) => {
    if (!dateString) return "Never studied"
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateString === today.toISOString().split("T")[0]) return "Today"
    if (dateString === yesterday.toISOString().split("T")[0]) return "Yesterday"
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Your Stacks</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Stack
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {stacks.map((stack) => (
          <Card
            key={stack.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedStack(stack)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{stack.name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{stack.cards.length} cards</span>
                    <span>Last studied: {formatLastStudied(stack.lastStudied)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">Today's Progress</div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{stack.todayStats.wordsStudied} words</span>
                      <span>{stack.todayStats.timeSpent}min</span>
                      {stack.todayStats.accuracy > 0 && <Badge variant="secondary">{stack.todayStats.accuracy}%</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stacks.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-medium mb-2">No stacks yet</h3>
            <p className="text-muted-foreground mb-4">Create your first stack to start studying!</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Stack
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateStackDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateStack={(stack) => setStacks([...stacks, stack])}
      />

      <ImportCSVDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportStack={(stack) => setStacks([...stacks, stack])}
      />

      <GlobalSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={globalSettings}
        onUpdateSettings={setGlobalSettings}
      />
    </div>
  )
}
