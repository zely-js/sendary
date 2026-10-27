import { Link } from 'sendary/components';

export default function IndexPage() {
  return (
    <>
      <title>Sendary App</title>
      <h1>Sendary App</h1>
      <p>
        Edit <code>pages/index.tsx</code> and save to see the changes.
      </p>
      <p>
        <Link href="/post/hello">Open the example post</Link>
      </p>
    </>
  );
}
