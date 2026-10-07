import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import { Tag } from "../domain/tag.ts";
import { TagColor, type TagColorError } from "../domain/tag-color.ts";
import { TagId, type TagIdError } from "../domain/tag-id.ts";
import { TagName, type TagNameError } from "../domain/tag-name.ts";
import type { TagRepository } from "../domain/tag-repository.ts";
import { toTagDto, type TagDto } from "./tag-dto.ts";

export type TagNotFound = { readonly type: "TagNotFound" };
export type TagNameDuplicate = { readonly type: "TagNameDuplicate" };

export interface TagUseCaseDeps {
  readonly tags: TagRepository;
}

/** 同じ名前（大文字・小文字、全角・半角を区別しない）のタグが、except 以外にあるか */
const nameTaken = async (
  tags: TagRepository,
  ownerId: OwnerId,
  name: string,
  except?: TagId,
): Promise<boolean> => {
  const key = TagName.normalize(name);
  return (await tags.findAllByOwner(ownerId)).some(
    (t) => t.id !== except && TagName.normalize(t.name) === key,
  );
};

const findTag = async (
  deps: TagUseCaseDeps,
  ownerId: OwnerId,
  rawId: string,
): Promise<Result<Tag, TagIdError | TagNotFound>> => {
  const id = TagId.parse(rawId);
  if (!id.ok) return id;
  const tag = await deps.tags.findById(ownerId, id.value);
  return tag === null ? err({ type: "TagNotFound" }) : ok(tag);
};

export type CreateTagError =
  | TagIdError
  | TagNameError
  | TagColorError
  | TagNameDuplicate
  | { readonly type: "TagAlreadyExists" };

/** タグを作る。色を指定しなければ、作った順に 8 色を順番に割り当てる */
export class CreateTag {
  private readonly deps: TagUseCaseDeps;

  constructor(deps: TagUseCaseDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly id: string;
    readonly name: string;
    readonly color?: string | undefined;
  }): Promise<Result<TagDto, CreateTagError>> {
    const id = TagId.parse(input.id);
    if (!id.ok) return id;
    const name = TagName.create(input.name);
    if (!name.ok) return name;
    const color = input.color === undefined ? null : TagColor.parse(input.color);
    if (color !== null && !color.ok) return color;
    if ((await this.deps.tags.findById(input.ownerId, id.value)) !== null) {
      return err({ type: "TagAlreadyExists" });
    }
    const existing = await this.deps.tags.findAllByOwner(input.ownerId);
    if (await nameTaken(this.deps.tags, input.ownerId, name.value)) {
      return err({ type: "TagNameDuplicate" });
    }
    const tag = Tag.create({
      id: id.value,
      ownerId: input.ownerId,
      name: name.value,
      color: color?.value ?? TagColor.forIndex(existing.length),
    });
    await this.deps.tags.save(tag);
    return ok(toTagDto(tag));
  }
}

export type RenameTagError = TagIdError | TagNotFound | TagNameError | TagNameDuplicate;

export class RenameTag {
  private readonly deps: TagUseCaseDeps;

  constructor(deps: TagUseCaseDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly id: string;
    readonly name: string;
  }): Promise<Result<TagDto, RenameTagError>> {
    const tag = await findTag(this.deps, input.ownerId, input.id);
    if (!tag.ok) return tag;
    const name = TagName.create(input.name);
    if (!name.ok) return name;
    if (await nameTaken(this.deps.tags, input.ownerId, name.value, tag.value.id)) {
      return err({ type: "TagNameDuplicate" });
    }
    tag.value.rename(name.value);
    await this.deps.tags.save(tag.value);
    return ok(toTagDto(tag.value));
  }
}

export type RecolorTagError = TagIdError | TagNotFound | TagColorError;

export class RecolorTag {
  private readonly deps: TagUseCaseDeps;

  constructor(deps: TagUseCaseDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly id: string;
    readonly color: string;
  }): Promise<Result<TagDto, RecolorTagError>> {
    const tag = await findTag(this.deps, input.ownerId, input.id);
    if (!tag.ok) return tag;
    const color = TagColor.parse(input.color);
    if (!color.ok) return color;
    tag.value.recolor(color.value);
    await this.deps.tags.save(tag.value);
    return ok(toTagDto(tag.value));
  }
}

export type DeleteTagError = TagIdError | TagNotFound;

/** タグを削除する。タスクの tagIds は書き換えず、表示・集計で存在しないタグとして外す（ADR 0007） */
export class DeleteTag {
  private readonly deps: TagUseCaseDeps;

  constructor(deps: TagUseCaseDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly id: string;
  }): Promise<Result<{ readonly id: string }, DeleteTagError>> {
    const tag = await findTag(this.deps, input.ownerId, input.id);
    if (!tag.ok) return tag;
    await this.deps.tags.remove(input.ownerId, tag.value.id);
    return ok({ id: tag.value.id });
  }
}

export class ListTags {
  private readonly deps: TagUseCaseDeps;

  constructor(deps: TagUseCaseDeps) {
    this.deps = deps;
  }

  /** 名前順（日本語の並び）で返す */
  async execute(input: { readonly ownerId: OwnerId }): Promise<TagDto[]> {
    const tags = await this.deps.tags.findAllByOwner(input.ownerId);
    return tags.map(toTagDto).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
}
