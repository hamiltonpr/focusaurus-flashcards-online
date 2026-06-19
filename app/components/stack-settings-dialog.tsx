"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Edit3, Save, X, Upload, CheckCircle2 } from "lucide-react"
import type { Stack, Card as FlashCard, StackSettings } from "../types"
import ImportCSVIntoStackDialog from "./import-csv-into-stack-dialog"
import { getTodayString, addDays } from "../lib/spaced-repetition"
import { dedupeCardsById, generateCardId } from "../lib/card-utils"

interface StackSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stack: Stack
  onUpdateStack: (stack: Stack) => void
}

const DEFAULT_STACK_SETTINGS: StackSettings = {
  loopSize: 4,
  shortTermSize: 5,
  wrongStreakLimit: 3,
}

export default function StackSettingsDialog({ open, onOpenChange, stack, onUpdateStack }: StackSettingsDialogProps) {
  const [stackName, setStackName] = useState(stack.name)
  const [cards, setCards] = useState<FlashCard[]>(() => dedupeCardsById(stack.cards))
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editFront, setEditFront] = useState("")
  const [editBack, setEditBack] = useState("")
  const [newCardFront, setNewCardFront] = useState("")
  const [newCardBack, setNewCardBack] = useState("")
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stackSettings, setStackSettings] = useState<StackSettings>(
    stack.stackSettings ?? DEFAULT_STACK_SETTINGS,
  )

  const handleSave = () => {
    const updatedStack: Stack = {
      ...stack,
      name: stackName,
      cards: cards,
      stackSettings,
    }
    onUpdateStack(updatedStack)
    onOpenChange(false)
  }

  const handleDeleteCard = (cardId: string) => {
    setCards(cards.filter((card) => card.id !== cardId))
  }

  const handleEditCard = (card: FlashCard) => {
    setEditingCard(card.id)
    setEditFront(card.front)
    setEditBack(card.back)
  }

  const handleSaveEdit = () => {
    if (editingCard) {
      setCards(cards.map((card) => (card.id === editingCard ? { ...card, front: editFront, back: editBack } : card)))
      setEditingCard(null)
      setEditFront("")
      setEditBack("")
    }
  }

  const handleCancelEdit = () => {
    setEditingCard(null)
    setEditFront("")
    setEditBack("")
  }

  const handleAddCard = () => {
    if (newCardFront.trim() && newCardBack.trim()) {
      const newCard: FlashCard = {
        id: generateCardId(),
        front: newCardFront.trim(),
        back: newCardBack.trim(),
        cardType: 1,
        interval: 0,
      }
      setCards([...cards, newCard])
      setNewCardFront("")
      setNewCardBack("")
    }
  }

  const handleImportCards = (newCards: FlashCard[]) => {
    const withFreshIds = newCards.map((card) => ({ ...card, id: generateCardId() }))
    setCards(dedupeCardsById([...cards, ...withFreshIds]))
  }

  const handleMarkKnown = (cardId: string) => {
    const interval = Math.floor(Math.random() * (365 - 7 + 1)) + 7
    const nextReviewDate = addDays(getTodayString(), interval)
    setCards(cards.map((card) =>
      card.id === cardId ? { ...card, cardType: 2, interval, nextReviewDate } : card
    ))
  }

  const unlearnedCards = cards.filter((c) => c.cardType !== 2)
  const allSelected = unlearnedCards.length > 0 && unlearnedCards.every((c) => selectedIds.has(c.id))

  const toggleSelect = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(cardId) ? next.delete(cardId) : next.add(cardId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unlearnedCards.map((c) => c.id)))
    }
  }

  const handleMarkSelectedKnown = () => {
    const today = getTodayString()
    setCards(cards.map((card) => {
      if (!selectedIds.has(card.id)) return card
      const interval = Math.floor(Math.random() * (365 - 7 + 1)) + 7
      return { ...card, cardType: 2, interval, nextReviewDate: addDays(today, interval) }
    }))
    setSelectedIds(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85dvh] sm:max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit Stack</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Stack Name */}
          <div className="space-y-2">
            <Label htmlFor="stackName">Stack Name</Label>
            <Input
              id="stackName"
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              placeholder="Stack name"
            />
          </div>

          {/* Session Settings */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Session Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loopSize">Loop size</Label>
                  <Input
                    id="loopSize"
                    type="number"
                    min="2"
                    max="10"
                    value={stackSettings.loopSize}
                    onChange={(e) =>
                      setStackSettings({ ...stackSettings, loopSize: Math.max(2, Number(e.target.value) || 2) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Cards active at once</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortTermSize">Short-term queue</Label>
                  <Input
                    id="shortTermSize"
                    type="number"
                    min="1"
                    max="20"
                    value={stackSettings.shortTermSize}
                    onChange={(e) =>
                      setStackSettings({ ...stackSettings, shortTermSize: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Batch review size</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wrongStreakLimit">Wrong streak limit</Label>
                  <Input
                    id="wrongStreakLimit"
                    type="number"
                    min="1"
                    max="10"
                    value={stackSettings.wrongStreakLimit}
                    onChange={(e) =>
                      setStackSettings({
                        ...stackSettings,
                        wrongStreakLimit: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Before reverting to type-1</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add New Card */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Add New Card</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newFront">Front (foreign language)</Label>
                  <Input
                    id="newFront"
                    value={newCardFront}
                    onChange={(e) => setNewCardFront(e.target.value)}
                    placeholder="e.g. Bonjour"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newBack">Back (English)</Label>
                  <Input
                    id="newBack"
                    value={newCardBack}
                    onChange={(e) => setNewCardBack(e.target.value)}
                    placeholder="e.g. Hello"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button onClick={handleAddCard} className="w-full sm:w-auto" disabled={!newCardFront.trim() || !newCardBack.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
                <Button variant="outline" onClick={() => setShowImportDialog(true)} className="w-full sm:w-auto">
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cards List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Cards ({cards.length})</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{cards.filter((card) => card.cardType === 2).length} learned</Badge>
              </div>
            </div>

            {unlearnedCards.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSelected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                    {allSelected && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
                  </div>
                  {allSelected ? "Deselect all" : "Select all unlearned"}
                </button>
                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    onClick={handleMarkSelectedKnown}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Mark {selectedIds.size} as known
                  </Button>
                )}
              </div>
            )}

            {cards.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p>No cards in this stack yet.</p>
                  <p className="text-sm">Add some cards above to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cards.map((card) => (
                  <Card key={card.id} className="relative">
                    <CardContent className="p-4">
                      {editingCard === card.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Front (foreign)</Label>
                              <Input value={editFront} onChange={(e) => setEditFront(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Back (English)</Label>
                              <Input value={editBack} onChange={(e) => setEditBack(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {card.cardType !== 2 && (
                              <button
                                onClick={() => toggleSelect(card.id)}
                                className={`flex-shrink-0 w-4 h-4 mt-1 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(card.id) ? "bg-primary border-primary" : "border-muted-foreground hover:border-foreground"}`}
                              >
                                {selectedIds.has(card.id) && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
                              </button>
                            )}
                            {card.cardType === 2 && <div className="w-4 flex-shrink-0" />}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                              <div className="min-w-0">
                                <div className="text-xs text-muted-foreground mb-1">Front (foreign)</div>
                                <div className="font-medium break-words">{card.front}</div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs text-muted-foreground mb-1">Back (English)</div>
                                <div className="break-words">{card.back}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:ml-2 self-end sm:self-auto">
                            {card.cardType === 2 && (
                              <Badge variant="secondary" className="text-xs bg-primary/10">
                                Learned
                              </Badge>
                            )}
                            {card.interval > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {card.interval}d
                              </Badge>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleEditCard(card)}>
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteCard(card.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">Save Changes</Button>
        </div>
        <ImportCSVIntoStackDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImportCards={handleImportCards}
        />
      </DialogContent>
    </Dialog>
  )
}
