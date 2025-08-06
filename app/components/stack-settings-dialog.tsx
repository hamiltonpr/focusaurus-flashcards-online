"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Edit3, Save, X, Upload } from "lucide-react"
import type { Stack, Card as FlashCard } from "../types"
import ImportCSVIntoStackDialog from "./import-csv-into-stack-dialog"

interface StackSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stack: Stack
  onUpdateStack: (stack: Stack) => void
}

export default function StackSettingsDialog({ open, onOpenChange, stack, onUpdateStack }: StackSettingsDialogProps) {
  const [stackName, setStackName] = useState(stack.name)
  const [cards, setCards] = useState<FlashCard[]>(stack.cards)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editFront, setEditFront] = useState("")
  const [editBack, setEditBack] = useState("")
  const [newCardFront, setNewCardFront] = useState("")
  const [newCardBack, setNewCardBack] = useState("")
  const [showImportDialog, setShowImportDialog] = useState(false)

  const handleSave = () => {
    const updatedStack: Stack = {
      ...stack,
      name: stackName,
      cards: cards,
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
        id: `${Date.now()}-${Math.random()}`,
        front: newCardFront.trim(),
        back: newCardBack.trim(),
      }
      setCards([...cards, newCard])
      setNewCardFront("")
      setNewCardBack("")
    }
  }

  const handleImportCards = (newCards: FlashCard[]) => {
    setCards([...cards, ...newCards])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
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

          {/* Add New Card */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Add New Card</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newFront">Front</Label>
                  <Input
                    id="newFront"
                    value={newCardFront}
                    onChange={(e) => setNewCardFront(e.target.value)}
                    placeholder="Front of card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newBack">Back</Label>
                  <Input
                    id="newBack"
                    value={newCardBack}
                    onChange={(e) => setNewCardBack(e.target.value)}
                    placeholder="Back of card"
                  />
                </div>
              </div>
              <Button onClick={handleAddCard} className="mt-3" disabled={!newCardFront.trim() || !newCardBack.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Card
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)} className="mt-3 ml-2">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </CardContent>
          </Card>

          {/* Cards List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Cards ({cards.length})</h3>
              <Badge variant="secondary">{cards.filter((card) => card.mastered).length} mastered</Badge>
            </div>

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
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Front</Label>
                              <Input value={editFront} onChange={(e) => setEditFront(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Back</Label>
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
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Front</div>
                              <div className="font-medium">{card.front}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Back</div>
                              <div>{card.back}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {card.mastered && (
                              <Badge variant="secondary" className="text-xs">
                                Mastered
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
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
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
