<script lang="ts">
	import "../app.css";
	import { page } from "$app/state";
	import {
		Inbox,
		Users,
		LayoutGrid,
		Zap,
		ChevronRight,
		Search,
	} from "lucide-svelte";
	import { cn } from "$lib/utils";

	let { children } = $props();

	const navItems = [
		{ href: "/", label: "All Tickets", icon: LayoutGrid },
		{ href: "/?status=open", label: "Open", icon: Inbox },
		{ href: "/?assigneeId=alicia", label: "Alicia's Tickets", icon: Users },
		{ href: "/?assigneeId=max", label: "Max's Tickets", icon: Users },
		{ href: "/?assigneeId=alessandro", label: "Alessandro's", icon: Users },
	];

	let currentPath = $derived(page.url.pathname + page.url.search);
</script>

<div class="flex h-screen overflow-hidden">
	<!-- Sidebar -->
	<aside
		class="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col"
	>
		<!-- Logo -->
		<div class="h-16 flex items-center px-5 border-b border-sidebar-border">
			<div class="flex items-center gap-2.5">
				<div
					class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center"
				>
					<Zap class="w-4 h-4 text-white" />
				</div>
				<div>
					<h1 class="text-sm font-semibold text-sidebar-foreground">
						Studyflash
					</h1>
					<p
						class="text-[10px] text-muted-foreground tracking-wider uppercase"
					>
						Support
					</p>
				</div>
			</div>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
			<p
				class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2"
			>
				Views
			</p>
			{#each navItems as item}
				{@const isActive =
					currentPath === item.href ||
					(item.href === "/" &&
						page.url.pathname === "/" &&
						!page.url.search)}
				<a
					href={item.href}
					class={cn(
						"flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150",
						isActive
							? "bg-sidebar-hover text-sidebar-foreground font-medium"
							: "text-muted-foreground hover:bg-sidebar-hover/50 hover:text-sidebar-foreground",
					)}
				>
					<item.icon class="w-4 h-4 shrink-0" />
					<span class="truncate">{item.label}</span>
					{#if isActive}
						<ChevronRight class="w-3 h-3 ml-auto opacity-50" />
					{/if}
				</a>
			{/each}
		</nav>

		<!-- User section -->
		<div class="p-3 border-t border-sidebar-border">
			<div class="flex items-center gap-2.5 px-2.5 py-2">
				<div
					class="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-xs font-semibold text-white"
				>
					A
				</div>
				<div class="min-w-0">
					<p
						class="text-xs font-medium text-sidebar-foreground truncate"
					>
						Alessandro
					</p>
					<p class="text-[10px] text-muted-foreground truncate">
						Engineering
					</p>
				</div>
			</div>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto bg-background">
		{@render children()}
	</main>
</div>
