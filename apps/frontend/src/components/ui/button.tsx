import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/25 active:scale-[0.97]",
                outline:
                    "border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-accent-foreground active:scale-[0.97]",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md active:scale-[0.97]",
                ghost: "hover:bg-accent hover:text-accent-foreground active:scale-[0.97]",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 px-3 text-xs",
                lg: "h-11 px-6 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

/**
 * Round-2 action system (mockup `idesk.css` "Action system"), styled by `.idesk-btn` in index.css:
 * exactly one `primary` per surface; `soft` = secondary (surface, icon + label); `subtle` = tertiary ghost;
 * `danger` = soft red text (always behind a confirm) whose confirm uses `danger-solid`.
 * 32px desktop / 40px coarse pointer, 10px radius, 16px icons, 3px focus ring. Amber stays the topbar CTA only.
 * Legacy variants (default/destructive/outline/secondary/ghost/link) keep their previous styling.
 */
const actionButtonVariants = cva("idesk-btn", {
    variants: {
        variant: {
            primary: "is-primary",
            soft: "is-soft",
            subtle: "is-ghost",
            danger: "is-danger",
            "danger-solid": "is-danger is-solid",
        },
        size: {
            default: "",
            sm: "",
            lg: "is-lg",
            icon: "is-icon",
        },
    },
    defaultVariants: { variant: "soft", size: "default" },
})

type LegacyVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
type ActionVariant = NonNullable<VariantProps<typeof actionButtonVariants>["variant"]>

const ACTION_VARIANTS: ReadonlySet<string> = new Set<ActionVariant>(["primary", "soft", "subtle", "danger", "danger-solid"])
const isActionVariant = (variant: unknown): variant is ActionVariant =>
    typeof variant === "string" && ACTION_VARIANTS.has(variant)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "variant"> {
    variant?: LegacyVariant | ActionVariant | null
    asChild?: boolean
    /** Sets aria-busy, disables the button and shows a spinner before the label (ignored with `asChild`). */
    loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
        const classes = isActionVariant(variant)
            ? cn(actionButtonVariants({ variant, size }), className)
            : buttonVariants({ variant, size, className })
        if (asChild) {
            return <Slot className={classes} ref={ref} {...props}>{children}</Slot>
        }
        return (
            <button
                className={classes}
                ref={ref}
                {...props}
                disabled={props.disabled || loading}
                aria-busy={loading || undefined}
            >
                {loading && <Loader2 className="idesk-spin" aria-hidden="true" />}
                {children}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants, actionButtonVariants }
