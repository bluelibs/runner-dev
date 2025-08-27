import { createToolCallAccumulator } from "../../ui/src/components/Documentation/components/chat/ai.service";

describe("createToolCallAccumulator", () => {
  it("accumulates tool call chunks in order", () => {
    const acc = createToolCallAccumulator();
    acc.accept({
      index: 0,
      id: "abc",
      function: { name: "fn", arguments: "{" },
    });
    acc.accept({ index: 0, function: { arguments: '"x":1' } });
    acc.accept({ index: 0, function: { arguments: "}" } });

    const list = acc.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("abc");
    expect(list[0].name).toBe("fn");
    expect(list[0].argsText).toBe('{"x":1}');
  });
});
