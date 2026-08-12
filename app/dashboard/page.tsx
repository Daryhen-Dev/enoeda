import { BuildingIcon, UsersIcon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const summaryCards = [
  {
    title: "Branches",
    description: "Manage academy locations and time zones.",
    icon: BuildingIcon,
  },
  {
    title: "Students",
    description: "Manage student profiles and enrollment.",
    icon: UsersIcon,
  },
] as const

export default function DashboardOverview() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">Welcome to Enoeda Academy</h2>
        <p className="text-sm text-muted-foreground">
          Your academy management workspace is ready for you.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <div
              key={card.title}
              aria-disabled="true"
              className="cursor-not-allowed opacity-60"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle>{card.title}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Coming soon
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
