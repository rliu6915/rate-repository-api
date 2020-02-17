import { gql } from 'apollo-server';
import { get } from 'lodash';
import * as yup from 'yup';

import createPaginatedQuery from '../../utils/createPaginatedQuery';

export const typeDefs = gql`
  type Repository {
    id: ID!
    ownerName: String!
    name: String!
    user: User!
    stargazersCount: Int!
    watchersCount: Int!
    forksCount: Int!
    openIssuesCount: Int!
    createdAt: DateTime!
    fullName: String!
    reviews(first: Int, after: String): ReviewConnection!
    ratingAverage: Int!
    reviewCount: Int!
    url: String
    ownerAvatarUrl: String
    description: String
  }
`;

const reviewsArgsSchema = yup.object({
  after: yup.string(),
  first: yup
    .number()
    .min(1)
    .max(40)
    .default(40),
});

const makeGithubRepositoryResolver = getValue => async (
  { ownerName, name },
  args,
  { githubClient },
) => {
  return getValue(await githubClient.getRepository(ownerName, name));
};

export const resolvers = {
  Repository: {
    user: ({ userId }, args, { dataLoaders: { userLoader } }) => {
      return userLoader.load(userId);
    },
    reviews: async (obj, args, { models: { Review } }) => {
      const normalizedArgs = await reviewsArgsSchema.validate(args);

      return createPaginatedQuery(
        () =>
          Review.query().where({
            repositoryId: obj.id,
          }),
        {
          orderColumn: 'createdAt',
          orderDirection: 'desc',
          first: normalizedArgs.first,
          after: normalizedArgs.after,
        },
      );
    },
    ratingAverage: async (
      { id },
      args,
      { dataLoaders: { repositoryRatingAverageLoader } },
    ) => Math.round(await repositoryRatingAverageLoader.load(id)),
    reviewCount: (
      { id },
      args,
      { dataLoaders: { repositoryReviewCountLoader } },
    ) => repositoryReviewCountLoader.load(id),
    fullName: ({ ownerName, name }) => [ownerName, name].join('/'),
    ownerAvatarUrl: makeGithubRepositoryResolver(repository =>
      get(repository, 'owner.avatar_url'),
    ),
    description: makeGithubRepositoryResolver(repository =>
      get(repository, 'description'),
    ),
    stargazersCount: makeGithubRepositoryResolver(
      repository => get(repository, 'stargazers_count') || 0,
    ),
    watchersCount: makeGithubRepositoryResolver(
      repository => get(repository, 'watchers_count') || 0,
    ),
    forksCount: makeGithubRepositoryResolver(
      repository => get(repository, 'forks_count') || 0,
    ),
    openIssuesCount: makeGithubRepositoryResolver(
      repository => get(repository, 'open_issues_count') || 0,
    ),
    url: makeGithubRepositoryResolver(repository => get(repository, 'url')),
  },
};

export default {
  typeDefs,
  resolvers,
};
