import { Link } from 'staga/components';

const posts = {
  hello: {
    title: 'Hello, Staga',
    body: 'This page is generated from pages/post/[id].tsx.',
  },
  world: {
    title: 'Hello, world',
    body: 'Add more entries to posts and Staga will generate a page for each one.',
  },
};

export function getStaticParams() {
  return Object.keys(posts).map((id) => ({ id }));
}

export function getStaticProps({ params }: { params: { id: string } }) {
  const post = posts[params.id as keyof typeof posts];

  return (
    post ?? {
      title: 'Post not found',
      body: `There is no post with the id "${params.id}".`,
    }
  );
}

export default function PostPage({ props }: { props: { title: string; body: string } }) {
  return (
    <>
      <title>{props.title}</title>
      <h1>{props.title}</h1>
      <p>{props.body}</p>
      <p>
        <Link href="/">Back home</Link>
      </p>
    </>
  );
}
