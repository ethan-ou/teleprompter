<script lang="ts">
  import Status from "./features/status.svelte";
  import Navbar from "./features/navbar/index.svelte";
  import Content from "./features/content/index.svelte";
  import Capture from "./features/capture/index.svelte";
  import Collaborate from "./features/collaborate/index.svelte";
  import { isMobileOrTablet } from "./lib/device";

  const mobileOrTablet = isMobileOrTablet();
</script>


<Status />
<Navbar />
{#if !mobileOrTablet}
  <Capture />
{/if}
<Content />
<Collaborate />
