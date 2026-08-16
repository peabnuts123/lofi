import { Comment, ReflectionKind, Converter, Application, JSX } from 'typedoc';

/** @type {import('typedoc').TypeDocOptionMap} */
export default {
  entryPoints: [
    "src/core",
    "src/engine",
  ],
  /*
    @NOTE It is important that packages are built (using declarationMap: true)
    for typedoc to be able to pick up cross-package references
  */
  entryPointStrategy: "packages",
  packageOptions: {
    entryPoints: ["src"],
    entryPointStrategy: "expand",
    exclude: ["**/*.test.ts", "src/index.ts"],
    disableSources: true,
    readme: "docs/index.md",
  },
  projectDocuments: [
    "README.md",
  ],
  plugin: [
    stripTodoTagsPlugin,
    defaultDescriptionsPlugin,
    copyLinkButtonPlugin,
    collapseSidebarButtonPlugin,
    stripReferencesPlugin,
  ],
  router: 'structure',
  out: "./docs",
  customCss: 'typedoc.css'
};

/**
 * Plugin that removes internal `@TODO` block tags from generated docs.
 * @param {Application} application
 */
function stripTodoTagsPlugin(application) {
  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(ReflectionKind.All)) {
      reflection.comment?.removeTags('@TODO');
    }
  });
}

/**
 * Plugin that sets a default description on undocumented elements.
 * @param {Application} application
 */
function defaultDescriptionsPlugin(application) {
  const DebugShowTypes = false;
  /** List of ReflectionKinds that should be given a default description (if not otherwise documented). */
  const DefaultDescriptionKinds = ReflectionKind.All
    ^ ReflectionKind.Parameter      // Should ideally be documented, but otherwise likely self-evident
    ^ ReflectionKind.Module         // Too high level / can't be documented
    ^ ReflectionKind.Project        // Too high level / can't be documented
    ^ ReflectionKind.TypeLiteral    // Seems to be implicit / can't be documented
    ;

  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(DefaultDescriptionKinds)) {
      const summary = reflection.comment?.summary ?? [];
      if (summary.some((part) => part.text.trim().length > 0)) {
        continue;
      }

      reflection.comment = new Comment([
        {
          kind: 'text',
          text: `No description provided.${DebugShowTypes ? ` [DEBUG kind='${ReflectionKind[reflection.kind]}']` : ""}`,
        },
      ]);
    }
  });
}

/**
 * Plugin that adds a button for copying the current page as a `@link` target.
 * @param {Application} application
 */
function copyLinkButtonPlugin(application) {
  // Callback function called when user clicks the button
  // @NOTE Copied into DOM via `.toString()`
  async function onClickCopy() {
    const link = event.target.dataset.copyLink;
    await navigator.clipboard.writeText(link);
    console.log('Copied @link: ' + link);
  };

  // Add button to the DOM
  application.renderer.hooks.on("content.begin", (context) => {
    const link = getLinkForReflection(context.page.model);
    if (!link) return;

    return JSX.createElement(
      "button",
      {
        "type": "button",
        // "class": "tsd-copy-link-button",
        "data-copy-link": link,
        "onclick": `${onClickCopy.name}()`,
      },
      "Copy @link",
    );
  });

  // Copy callback function into DOM
  application.renderer.hooks.on("body.end", () => JSX.createElement(JSX.Raw, {
    html: `<script>${onClickCopy}</script>`
  }));

  /**
   * Get the `@link` path for a property
   * @param {import('typedoc').Reflection} reflection
   */
  function getLinkForReflection(reflection) {
    if (reflection.isProject() || reflection.isDocument() || reflection.isReference() || reflection.kind === ReflectionKind.Module) {
      return undefined;
    }

    const pathParts = [];
    let current = reflection;
    while (
      current !== undefined &&
      !current.isProject() &&
      current.name.startsWith('@lopoly/') === false
    ) {
      pathParts.unshift(current.name);
      current = current.parent
    }

    return `{@link ${pathParts.join(".")} ${reflection.name}}`;
  }
}


/**
 * Plugin that adds a button for collapsing all sections in the sidebar.
 * @param {Application} application
 */
function collapseSidebarButtonPlugin(application) {
  // Callback function called when user clicks the button
  // @NOTE Copied into DOM via `.toString()`
  async function onClickCollapse() {
    document.querySelectorAll('#tsd-nav-container details.tsd-accordion').forEach((details) => details.open = false)
  };

  // Add button to the DOM
  application.renderer.hooks.on("sidebar.begin", (context) => {
    return JSX.createElement(
      "button",
      {
        "type": "button",
        "onclick": `${onClickCollapse.name}()`,
      },
      "Collapse all",
    );
  });

  // Copy callback function into DOM
  application.renderer.hooks.on("body.end", () => JSX.createElement(JSX.Raw, {
    html: `<script>${onClickCollapse}</script>`
  }));
}


/**
 * Plugin that removes `Reference` kind elements (basically just re-exports).
 * @param {Application} application
 */
function stripReferencesPlugin(application) {
  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(ReflectionKind.Reference)) {
      context.project.removeReflection(reflection)
    }
  });
}