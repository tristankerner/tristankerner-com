<script lang="ts">
    import {themeState} from "../lib/state.svelte.ts";
    import { connectCounterSocket } from "../lib/counterSocket.ts";
    import { onMount } from 'svelte';
    import { page } from "$app/state";
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
    import logo from '$lib/assets/logo.svg';
    import logo_inverted from '$lib/assets/logo-inverted.svg';
    import Counter from "$lib/Counter.svelte";
    import ConsentBanner from "$lib/consent/ConsentBanner.svelte";
    import { Navbar, NavBrand, NavLi, NavUl, NavHamburger,  DarkMode, Footer, FooterCopyright, FooterLinkGroup, FooterLink } from "flowbite-svelte";
    import { LinkedinSolid,  GithubSolid } from "flowbite-svelte-icons";

    let { children } = $props();
    let activeUrl = $derived(page.url.pathname);

    const updateTheme = () => {
        themeState.darkMode = document.documentElement.classList.contains('dark');
    };

    onMount(() => {
        connectCounterSocket();

        // https://github.com/themesberg/flowbite-svelte/discussions/1274
        updateTheme();
        const darkModeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    updateTheme();
                }
            });
        });
        darkModeObserver.observe(document.documentElement, {
            attributes: true,
        });
    });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
    <Navbar fluid>
        <NavBrand href="/">
            <img src={logo} class="me-3 h-12 sm:h-20 dark:hidden" alt="TK Logo" />
            <img src={logo_inverted} class="me-3 h-12 sm:h-20 hidden dark:block" alt="TK Logo" />
            <span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
        Tristan Kerner
      </span>
        </NavBrand>
        <div class="flex md:order-2">
            <DarkMode class="text-primary-500 dark:text-primary-600 border dark:border-gray-800" />
            <NavHamburger />
        </div>
        <NavUl activeUrl={activeUrl}>
            <NavLi href="/">Home</NavLi>
            <NavLi href="/blog">Blog</NavLi>
            <NavLi href="/memory-lane">Memory Ln</NavLi>
            <NavLi href="https://www.linkedin.com/in/tristan-kerner-754343135" target="_blank">LinkedIn</NavLi>
            <NavLi href="https://github.com/tristankerner" target="_blank">GitHub</NavLi>
            <NavLi href="/about-me">About</NavLi>
        </NavUl>
    </Navbar>
</div>
<main class="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
    <div class="flex float-right items-center justify-center">
        <Counter></Counter>
    </div>

    {@render children()}
</main>
<Footer>
    <FooterCopyright href="https://www.linkedin.com/in/tristan-kerner-754343135" by="Tristan Kerner™" year={2026} />
    <FooterLinkGroup class="mt-3 flex flex-wrap items-center text-sm text-gray-500 sm:mt-0 dark:text-gray-400">
        <FooterLink href="https://www.linkedin.com/in/tristan-kerner-754343135"><LinkedinSolid size="lg"/></FooterLink>
        <FooterLink href="https://github.com/tristankerner"><GithubSolid size="lg"/></FooterLink>
    </FooterLinkGroup>
</Footer>
<ConsentBanner />
