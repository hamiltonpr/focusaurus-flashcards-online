"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Zap, X } from "lucide-react"
import type { StoryToken } from "../api/generate-story/route"
import type { Card, Stack } from "../types"
import { isJapaneseLike } from "../lib/language-utils"
import { getTodayString, addDays } from "../lib/spaced-repetition"
import { generateCardId } from "../lib/card-utils"

interface StoryReaderProps {
  title: string
  tokens: StoryToken[]
  language: string
  stack: Stack
  onAddCard: (card: Card) => void
  onBumpCard: (cardId: string) => void
}

interface SelectedWord {
  token: StoryToken
  existingCard: Card | null
}

export default function StoryReader({ title, tokens, language, stack, onAddCard, onBumpCard }: StoryReaderProps) {
  const [selected, setSelected] = useState<SelectedWord | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [bumpedIds, setBumpedIds] = useState<Set<string>>(new Set())

  const japanese = isJapaneseLike(language)

  const findExistingCard = (text: string): Card | null => {
    const lower = text.toLowerCase()
    return stack.cards.find((c) => {
      const frontFirst = c.front.split("\n")[0].toLowerCase()
      const backFirst = c.back.split("\n")[0].toLowerCase()
      return frontFirst === lower || backFirst === lower
    }) ?? null
  }

  const handleTokenClick = (token: StoryToken) => {
    if (!token.isWord || !token.definition) return
    const existingCard = findExistingCard(token.text)
    setSelected({ token, existingCard })
  }

  const handleAddCard = () => {
    if (!selected) return
    const { token } = selected
    const newCard: Card = {
      id: generateCardId(),
      front: token.text,
      back: token.definition ?? "",
      cardType: 1,
      interval: 0,
    }
    onAddCard(newCard)
    setAddedIds((s) => new Set(s).add(token.text))
    setSelected(null)
  }

  const handleBump = () => {
    if (!selected?.existingCard) return
    onBumpCard(selected.existingCard.id)
    setBumpedIds((s) => new Set(s).add(selected!.existingCard!.id))
    setSelected(null)
  }

  const renderToken = (token: StoryToken, idx: number) => {
    if (!token.isWord) {
      return <span key={idx}>{token.text}</span>
    }

    const isKnown = !!findExistingCard(token.text)
    const wasAdded = addedIds.has(token.text)
    const hasDef = !!token.definition
    const clickable = hasDef

    const highlight = isKnown
      ? "border-b-2 border-primary/70 cursor-pointer"
      : wasAdded
        ? "border-b-2 border-primary cursor-pointer"
        : hasDef
          ? "border-b border-dotted border-muted-foreground/50 cursor-pointer hover:border-foreground"
          : ""

    if (japanese && token.reading && token.reading !== token.text) {
      return (
        <span
          key={idx}
          className={highlight}
          onClick={clickable ? () => handleTokenClick(token) : undefined}
        >
          {token.text}
        </span>
      )
    }

    return (
      <span
        key={idx}
        className={highlight}
        onClick={clickable ? () => handleTokenClick(token) : undefined}
      >
        {token.text}
      </span>
    )
  }

  return (
    <div className="relative">
      {/* Story title */}
      <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="border-b-2 border-primary/70 px-1">word</span> = in your stack
        </span>
        <span className="flex items-center gap-1">
          <span className="border-b border-dotted border-muted-foreground/50 px-1">word</span> = tap for definition
        </span>
      </div>

      {/* Story text */}
      <div className={`leading-loose text-lg mb-32 ${japanese ? "leading-[2.5]" : ""}`}>
        {tokens.map((token, idx) => renderToken(token, idx))}
      </div>

      {/* Word detail panel — slides up from bottom */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={() => setSelected(null)}
          />
          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t rounded-t-xl shadow-xl p-5 space-y-4 max-w-lg mx-auto">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold">{selected.token.text}</span>
                  {selected.token.reading && selected.token.reading !== selected.token.text && (
                    <span className="text-lg text-muted-foreground">{selected.token.reading}</span>
                  )}
                </div>
                <p className="text-base text-muted-foreground">{selected.token.definition}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {selected.existingCard ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Badge variant="secondary" className="text-xs bg-primary/10">Already in stack</Badge>
                  <span className="text-muted-foreground">
                    {selected.existingCard.front} → {selected.existingCard.back}
                  </span>
                </div>
                {bumpedIds.has(selected.existingCard.id) ? (
                  <p className="text-sm text-brand-teal">Scheduled for priority review tomorrow!</p>
                ) : (
                  <Button className="w-full" onClick={handleBump}>
                    <Zap className="w-4 h-4 mr-2" />
                    Study this ASAP — bump to top of tomorrow's queue
                  </Button>
                )}
              </div>
            ) : (
              <>
                {addedIds.has(selected.token.text) ? (
                  <p className="text-sm text-brand-teal">Added to stack as a new card!</p>
                ) : (
                  <Button className="w-full" onClick={handleAddCard}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add to stack as flashcard
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
