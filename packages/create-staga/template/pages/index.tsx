import { Link } from 'staga/components';

export default function IndexPage() {
  return (
    <>
      <title>Staga App</title>
      <h1>Staga App</h1>
      <p>
        Edit <code>pages/index.tsx</code> and save to see the changes.
      </p>
      <p>
        <Link href="/post/hello">Open the example post</Link>
      </p>
    </>
  );
}
