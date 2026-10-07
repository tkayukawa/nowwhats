import { describe, expect, it } from "vitest";
import {
  fixedClock,
  InMemoryTagRepository,
  InMemoryTaskRepository,
  OWNER,
  uuid,
} from "../testing/fixtures.ts";
import { CreateTask } from "./create-task.ts";
import { EditTask } from "./edit-task.ts";
import { CreateTag, DeleteTag, ListTags, RecolorTag, RenameTag } from "./tag-use-cases.ts";

const tagId = (n: number) => `0199b1a0-0000-7000-9000-${String(n).padStart(12, "0")}`;

const setup = () => {
  const tags = new InMemoryTagRepository();
  return {
    create: new CreateTag({ tags }),
    rename: new RenameTag({ tags }),
    recolor: new RecolorTag({ tags }),
    remove: new DeleteTag({ tags }),
    list: new ListTags({ tags }),
  };
};

describe("タグのユースケース", () => {
  it("作った順に色を割り当て、名前順で一覧にする", async () => {
    const { create, list } = setup();
    await create.execute({ ownerId: OWNER, id: tagId(1), name: " 仕事 " });
    await create.execute({ ownerId: OWNER, id: tagId(2), name: "お金" });

    expect(await list.execute({ ownerId: OWNER })).toEqual([
      { id: tagId(2), name: "お金", color: "orange", version: 1 },
      { id: tagId(1), name: "仕事", color: "blue", version: 1 },
    ]);
  });

  it("大文字・小文字、全角・半角の違いだけの名前は重複として拒否する", async () => {
    const { create, rename } = setup();
    await create.execute({ ownerId: OWNER, id: tagId(1), name: "Work" });

    expect(await create.execute({ ownerId: OWNER, id: tagId(2), name: "ｗｏｒｋ" })).toEqual({
      ok: false,
      error: { type: "TagNameDuplicate" },
    });
    await create.execute({ ownerId: OWNER, id: tagId(3), name: "Home" });
    expect(await rename.execute({ ownerId: OWNER, id: tagId(3), name: "WORK" })).toEqual({
      ok: false,
      error: { type: "TagNameDuplicate" },
    });
    // 自分自身の表記を変えるだけなら許可する
    expect(await rename.execute({ ownerId: OWNER, id: tagId(1), name: "WORK" })).toMatchObject({
      ok: true,
      value: { name: "WORK", version: 2 },
    });
  });

  it("名前の長さと色を検証する", async () => {
    const { create, recolor } = setup();

    expect(await create.execute({ ownerId: OWNER, id: tagId(1), name: " " })).toEqual({
      ok: false,
      error: { type: "TagNameEmpty" },
    });
    expect(await create.execute({ ownerId: OWNER, id: tagId(1), name: "あ".repeat(31) })).toEqual({
      ok: false,
      error: { type: "TagNameTooLong" },
    });
    await create.execute({ ownerId: OWNER, id: tagId(1), name: "a", color: "green" });
    expect(await recolor.execute({ ownerId: OWNER, id: tagId(1), color: "pink" })).toEqual({
      ok: false,
      error: { type: "TagColorInvalid" },
    });
    expect(await recolor.execute({ ownerId: OWNER, id: tagId(1), color: "red" })).toMatchObject({
      ok: true,
      value: { color: "red", version: 2 },
    });
  });

  it("削除したタグは一覧から消え、もう一度削除すると見つからない", async () => {
    const { create, remove, list } = setup();
    await create.execute({ ownerId: OWNER, id: tagId(1), name: "a" });

    expect(await remove.execute({ ownerId: OWNER, id: tagId(1) })).toEqual({
      ok: true,
      value: { id: tagId(1) },
    });
    expect(await list.execute({ ownerId: OWNER })).toEqual([]);
    expect(await remove.execute({ ownerId: OWNER, id: tagId(1) })).toEqual({
      ok: false,
      error: { type: "TagNotFound" },
    });
  });
});

describe("タスクのタグ", () => {
  it("登録・編集でタグを付け、重複は除き、11 個以上は拒否する", async () => {
    const repository = new InMemoryTaskRepository();
    const created = await new CreateTask({ repository, clock: fixedClock }).execute({
      ownerId: OWNER,
      id: uuid(1),
      title: "a",
      tagIds: [tagId(1), tagId(1), tagId(2)],
    });
    expect(created).toMatchObject({ ok: true, value: { tagIds: [tagId(1), tagId(2)] } });

    const edit = new EditTask({ repository, clock: fixedClock });
    expect(
      await edit.execute({
        ownerId: OWNER,
        id: uuid(1),
        changes: { tagIds: [tagId(2), tagId(1)] },
      }),
    ).toMatchObject({ ok: true, value: { version: 1 } }); // 集合として同じなので変更なし
    expect(
      await edit.execute({
        ownerId: OWNER,
        id: uuid(1),
        changes: { tagIds: Array.from({ length: 11 }, (_, i) => tagId(i + 1)) },
      }),
    ).toEqual({ ok: false, error: { type: "TaskTagsTooMany" } });
    expect(await edit.execute({ ownerId: OWNER, id: uuid(1), changes: { tagIds: ["x"] } })).toEqual(
      { ok: false, error: { type: "TagIdInvalid" } },
    );
  });
});
