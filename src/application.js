import axios from 'axios';
import i18next from 'i18next';
import _ from 'lodash';
import onChange from 'on-change';
import * as yup from 'yup';
import resources from './locales/index.js';
import render from './render.js';
import parseRSS from './utils/parser.js';

const getId = () => _.uniqueId();

const addProxy = (url) => {
  const allOriginsLink = 'https://allorigins.hexlet.app/get';

  const workingUrl = new URL(allOriginsLink);
  workingUrl.searchParams.set('disableCache', 'true');
  workingUrl.searchParams.set('url', url);
  return workingUrl.toString();
};

const getHttpContents = (url) => axios.get(addProxy(url))
  .catch((error) => {
    const message = error.message ?? 'default';
    switch (message) {
      case 'Network Error':
        throw Error('networkError');
      case 'default':
        throw Error('default');
      default:
        break;
    }
  });

const addPosts = (items, state, feedId) => {
  const posts = items.map((item) => ({
    feedId,
    id: getId(),
    ...item,
  }));
  state.posts = posts.concat(state.posts);
};

const setAutoUpdade = (state, timeout = 5000) => {
  const links = state.feeds.map(({ link }) => link);
  const promises = links.map((url) => getHttpContents(url)
    .then((response) => {
      const parsedRSS = parseRSS(response.data.contents);
      const postsUrls = state.posts
        .map(({ link }) => link);
      const newItems = parsedRSS.items.filter(({ link }) => !postsUrls.includes(link));
      if (newItems.length > 0) {
        addPosts(newItems, state);
      }
    }));
  Promise.all(promises)
    .finally(setTimeout(() => setAutoUpdade(state), timeout));
};

export default () => {
  const lng = 'ru';

  yup.setLocale({
    mixed: {
      default: 'default',
      required: 'empty',
      notOneOf: 'alreadyExists',
    },
    string: {
      url: 'invalidUrl',
    },
  });

  const validateURL = async (url, parsedLinks) => {
    const schema = yup
      .string()
      .required()
      .url()
      .notOneOf(parsedLinks);
    return schema.validate(url);
  };

  const i18nInstance = i18next.createInstance();
  i18nInstance
    .init({
      lng,
      debug: false,
      resources,
    })
    .then(() => {
      const elements = {
        form: document.querySelector('.rss-form'),
        urlInput: document.getElementById('url-input'),
        submitButton: document.querySelector('button[type="submit"]'),
        feedback: document.querySelector('.feedback'),
        feeds: document.querySelector('.feeds'),
        posts: document.querySelector('.posts'),
        modal: {
          title: document.querySelector('.modal-title'),
          body: document.querySelector('.modal-body'),
          fullArticleButton: document.querySelector('.full-article'),
        },
      };

      const initialState = {
        form: {
          state: 'idle',
          error: '',
        },
        feeds: [],
        posts: [],
        readPostIds: new Set(),
      };

      const state = onChange(
        initialState,
        render(elements, initialState, i18nInstance),
      );

      elements.form.addEventListener('submit', (e) => {
        const data = new FormData(e.target);
        let currentURL = data.get('url').trim();
        e.preventDefault();
        e.target.reset();
        state.form.error = '';
        state.form.state = 'sending';
        const parsedLinks = state.feeds.map(({ link }) => link);
        validateURL(currentURL, parsedLinks)
          .then(() => getHttpContents(currentURL))
          .then((response) => {
            const parsedRSS = parseRSS(response.data.contents);
            const feedId = getId();
            const feed = {
              id: feedId,
              title: parsedRSS.title,
              description: parsedRSS.description,
              link: currentURL,
            };
            state.feeds.push(feed);
            addPosts(parsedRSS.items, state, feedId);

            currentURL = '';
          })
          .catch((error) => {
            const message = error.isParsingError ? 'noRSS' : error.message;
            state.form.error = message;
          })
          .finally(() => {
            state.form.state = 'idle';
          });
      });

      elements.posts.addEventListener('click', (e) => {
        const post = state.posts
          .find(({ id }) => e.target.dataset.id === id);
        const {
          title,
          description,
          link,
          id,
        } = post;
        state.readPostIds.add(id);
        if (e.target.dataset.bsTarget !== '#modal') return;
        state.modal = { title, description, link };
      });
      setAutoUpdade(state);
    });
};
