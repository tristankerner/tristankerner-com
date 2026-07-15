<script lang="ts">
    import { page } from "$app/state";
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	let { children } = $props();
    import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, Skeleton, ImagePlaceholder, TextPlaceholder, DarkMode } from "flowbite-svelte";
    import { Footer, FooterBrand, FooterCopyright, FooterIcon, FooterLink, FooterLinkGroup } from "flowbite-svelte";
    import { FireOutline } from "flowbite-svelte-icons";
    import logo from '$lib/assets/favicon.svg';
    let activeUrl = $derived(page.url.pathname);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
    <Navbar fluid>
        <NavBrand href="/">
            <img src={favicon} class="me-3 h-6 sm:h-9" alt="TK Logo" />
            <span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
        Tristan Kerner
      </span>
        </NavBrand>
        <div class="flex md:order-2">
            <DarkMode class="text-primary-500 dark:text-primary-600 border dark:border-gray-800" />
            <NavHamburger />
        </div>
        <NavUl>
            <NavLi href="/">Home</NavLi>
            <NavLi href="/about-me">About</NavLi>

            <!-- You can stack any amount of custom or tall content here safely -->
        </NavUl>
    </Navbar>
</div>
<main class="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
{@render children()}
    <Footer>
        <FooterCopyright href="/" by="Tristan Kerner™" year={2026} />
<!--        <FooterLinkGroup class="mt-3 flex flex-wrap items-center text-sm text-gray-500 sm:mt-0 dark:text-gray-400">-->
<!--            <FooterLink href="/">About</FooterLink>-->
<!--            <FooterLink href="/">Privacy Policy</FooterLink>-->
<!--            <FooterLink href="/">Licensing</FooterLink>-->
<!--            <FooterLink href="/">Contact</FooterLink>-->
<!--        </FooterLinkGroup>-->
    </Footer>
</main>


