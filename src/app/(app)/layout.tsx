import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { shellLogoutPath } from "@/lib/mcq/navigation";
import { cn } from "@/lib/utils";

export default function AppShellLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<TooltipProvider>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="h-4" />
						<span className="text-sm font-medium text-foreground">
							QuizMaker
						</span>
						<Link
							href={shellLogoutPath()}
							className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
						>
							Log out
						</Link>
					</header>
					<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	);
}
