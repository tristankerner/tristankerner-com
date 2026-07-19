<script lang="ts">
    import type {Props} from "./types.ts";
    let {
        digit = '0',
        class: className,
        bgColor = '#FFFFFF',
        textColor = '#000000',
        strokeWidth = 25
    }: Props = $props();
</script>
<svg class={className} viewBox="0 0 455 750" xmlns="http://www.w3.org/2000/svg" >
    <defs />
    <rect width="100%" height="100%" fill={bgColor} />
    <metadata>image/svg+xml</metadata>
    <g>
    {#if digit === '0'}
        <title>Zero</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M400.02042,864.47382L400.02042,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M400.02042,492.73764L400.02042,173.52945" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {:else if digit === '1'}
        <title>One</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
    {:else if digit === '2'}
        <title>Two</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M400.02042,864.47382L400.02042,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {:else if digit === '3'}
        <title>Three</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {:else if digit === '4'}
        <title>Four</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M400.02042,492.73764L400.02042,173.52945" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
    {:else if digit === '5'}
        <title>Five</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M400.02042,492.73764L400.02042,173.52945" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {:else if digit === '6'}
        <title>Six</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M400.02042,864.47382L400.02042,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M400.02042,492.73764L400.02042,173.52945" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {:else if digit === '7'}
        <title>Seven</title>
        <path
                transform="translate(-2, 2) matrix(1, 0, 0, 1, -361.02, -146.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"/>
        <path
                transform="translate(-2, 2) matrix(1, 0, 0, 1, -361.02, -146.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="translate(-2, 2) matrix(1, 0, 0, 1, -361.02, -146.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="translate(-2, 2) matrix(1, 0, 0, 1, -361.02, -146.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="translate(-2, 2) matrix(1, 0, 0, 1, -361.02, -146.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
    {:else if digit === '8'}
        <title>Eight</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M400.02042,864.47382L400.02042,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M400.02042,492.73764L400.02042,173.52945" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"
                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {:else if digit === '9'}
        <title>Nine</title>
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,864.47382L775.79718,545.26563"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M775.79718,864.47382L775.79718,545.26563" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M400.02042,492.73764L400.02042,173.52945" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M775.79718,492.73764L775.79718,173.52945"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,519.00165L561.64482,519.00165"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,519.00165L751.55351,519.00165" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M422.24377,159.00162L561.64482,159.00162" />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M612.15247,159.00162L751.55351,159.00162"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"
                d="M422.24377,881.85876L561.64482,881.85876"
        />
        <path
                transform="matrix(1, 0, 0, 1, -360.02, -145.002)"

                fill="none"
                fill-rule="evenodd"
                stroke={textColor}
                stroke-width={strokeWidth}
                stroke-miterlimit="4"

                d="M612.15247,881.85876L751.55351,881.85876" />
    {/if}
    </g>
</svg>