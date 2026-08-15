import { Comment, ReflectionKind, Converter, CommentTag, Application } from 'typedoc';

/** @type {import("typedoc").TypeDocOptions} */
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
    exclude: ["**/*.test.ts"],
    disableSources: true,
    readme: "documents-todo-rename/index.md"
  },
  projectDocuments: [
    "README.md",
  ],
  // @TODO Probably need a plugin to strip @TODO
  plugin: [stripReferences, defaultDescriptions],
  router: 'structure',
  out: "./docs",
  customCss: 'typedoc.css'
};

/** List of ReflectionKinds that should be given a default description (if not otherwise documented). */
const DefaultDescriptionKinds = ReflectionKind.All
  ^ ReflectionKind.Parameter      // Should ideally be documented, but otherwise likely self-evident
  ^ ReflectionKind.Module         // Too high level / can't be documented
  ^ ReflectionKind.Project        // Too high level / can't be documented
  ^ ReflectionKind.TypeLiteral    // Seems to be implicit / can't be documented
  ;

/**
 * Plugin that sets a default description on undocumented elements.
 * @param {Application} application
 */
function defaultDescriptions(application) {
  const DebugShowTypes = false;

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
 * Plugin that removes `Reference` kind elements (basically just re-exports).
 * @param {Application} application
 */
function stripReferences(application) {
  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(ReflectionKind.Reference)) {
      context.project.removeReflection(reflection)
    }
  });
}