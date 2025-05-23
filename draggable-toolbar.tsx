"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Minus, Plus, RotateCcw, GripVertical, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface DraggableToolbarProps {
  onIncrement?: () => void
  onDecrement?: () => void
  onReset?: () => void
  className?: string
}

type EdgePosition = "top" | "bottom" | "left" | "right"

export function DraggableToolbar({ onIncrement, onDecrement, onReset, className }: DraggableToolbarProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [edge, setEdge] = useState<EdgePosition>("left")
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Calculate which edge is closest and snap to it
  const snapToEdge = (x: number, y: number) => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (!toolbarRef.current) return

    const toolbarWidth = toolbarRef.current.offsetWidth
    const toolbarHeight = toolbarRef.current.offsetHeight

    // Calculate distances to each edge
    const distanceToLeft = x
    const distanceToRight = viewportWidth - (x + toolbarWidth)
    const distanceToTop = y
    const distanceToBottom = viewportHeight - (y + toolbarHeight)

    // Find the closest edge
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom)

    let newEdge: EdgePosition
    let newX: number
    let newY: number

    if (minDistance === distanceToLeft) {
      newEdge = "left"
      newX = 20
      newY = Math.max(20, Math.min(y, viewportHeight - toolbarHeight - 20))
    } else if (minDistance === distanceToRight) {
      newEdge = "right"
      newX = viewportWidth - toolbarWidth - 20
      newY = Math.max(20, Math.min(y, viewportHeight - toolbarHeight - 20))
    } else if (minDistance === distanceToTop) {
      newEdge = "top"
      newX = Math.max(20, Math.min(x, viewportWidth - toolbarWidth - 20))
      newY = 20
    } else {
      newEdge = "bottom"
      newX = Math.max(20, Math.min(x, viewportWidth - toolbarWidth - 20))
      newY = viewportHeight - toolbarHeight - 20
    }

    setEdge(newEdge)
    setPosition({ x: newX, y: newY })
  }

  const resetPosition = () => {
    const defaultEdge: EdgePosition = "left"
    setEdge(defaultEdge)
    setPosition({ x: 20, y: 20 + window.innerHeight / 4 })
  }

  // Handle mouse down on the drag handle
  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
    }
  }

  // Handle mouse move when dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && toolbarRef.current) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Update position while dragging (free movement)
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        // Snap to nearest edge when drag ends
        snapToEdge(position.x, position.y)
        setIsDragging(false)
      }
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset, position])

  // Initialize position on mount
  useEffect(() => {
    if (toolbarRef.current) {
      snapToEdge(position.x, position.y)
    }
  }, [])

  const isVertical = edge === "left" || edge === "right"

  // Determine tooltip side based on toolbar position
  const getTooltipSide = (): "top" | "right" | "bottom" | "left" => {
    switch (edge) {
      case "left":
        return "right"
      case "right":
        return "left"
      case "top":
        return "bottom"
      case "bottom":
        return "top"
      default:
        return "right"
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={toolbarRef}
        className={cn(
          "fixed bg-background border rounded-lg shadow-lg p-1 select-none",
          isVertical ? "flex flex-col items-center" : "flex items-center",
          isDragging ? "cursor-grabbing transition-none" : "transition-all duration-300 ease-out",
          className,
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 50,
        }}
        aria-label="Toolbar"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="p-2 cursor-grab hover:bg-muted rounded-md"
              onMouseDown={handleMouseDown}
              aria-label="Drag handle"
            >
              <GripVertical className={cn("h-4 w-4", isVertical && "transform rotate-90")} />
            </div>
          </TooltipTrigger>
          <TooltipContent side={getTooltipSide()}>
            <p>Drag to move toolbar</p>
          </TooltipContent>
        </Tooltip>

        <div className={cn(isVertical ? "flex flex-col gap-1 py-1" : "flex gap-1 px-1")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onDecrement} aria-label="Decrement">
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Decrease counter</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onReset} aria-label="Reset">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Reset counter</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onIncrement} aria-label="Increment">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Increase counter</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={resetPosition} aria-label="Reset toolbar position">
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Reset toolbar position</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
