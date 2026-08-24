/* The header is a plate and a title, both of which fade in only once the
   screen's own large heading has scrolled away. It is pointer-events: none, so
   it never intercepts a tap meant for the content beneath it. */

export default function Header({ title, stuck }: { title: string; stuck: boolean }) {
  return (
    <div className={"header" + (stuck ? " stuck" : "")}>
      <div className="plate" />
      <div className="t">
        <span>{title}</span>
      </div>
    </div>
  );
}
