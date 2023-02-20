import axios from 'axios';
import i18next from 'i18next';
import onChange from 'on-change';
import { setLocale, string } from 'yup';
import resources from './locales/index.js';
import render from './render.js';
import parseRSS from './utils/parser.js';

let counter = 0;
const getId = () => {
  counter += 1;
  return counter;
};

const getAllOriginsResponse = (url) => {
  const allOriginsLink = 'https://allorigins.hexlet.app/get';

  const workingUrl = new URL(allOriginsLink);
  workingUrl.searchParams.set('disableCache', 'true');
  workingUrl.searchParams.set('url', url);
  return workingUrl.toString();
};

const getHttpContents = (url) => axios.get(getAllOriginsResponse(url))
  .catch(() => { throw Error('networkError'); })
  .then((response) => {
    const responseData = response.data.contents;
    return responseData;
  });

const addPosts = (feedId, items, state) => {
  const posts = items.map((item) => ({
    feedId,
    id: getId(),
    ...item,
  }));
  state.posts = posts.concat(state.posts);
};

const setAutoUpdade = (feedId, state, timeout = 5000) => {
  const inner = () => {
    const links = state.feeds.map(({ link }) => link);
    // console.log(links)
    const promises = links.map((url) => getHttpContents(url)
      .then(response => parseRSS(response))
      .then(parsedRSS => {
      // console.log('parsedRSS > ', parsedRSS)
        const postsUrls = state.posts
          .filter((post) => feedId === post.feedId)
          .map(({ link }) => link);
          // console.log('postsUrls  >', postsUrls)
          //  где-то тут ошибка, которую я в упор не вижу
        const newItems = parsedRSS.items.filter(({ link }) => !postsUrls.includes(link));
        // console.log('newItems >', newItems);
        if (newItems.length > 0) {
          addPosts(feedId, newItems, state);
        }
      }));
    Promise.all(promises)
      .finally(() => {
        setTimeout(inner, timeout);
      });
  };

  setTimeout(inner, timeout);
};

export default () => {
  const lng = 'ru';

  setLocale({
    mixed: {
      default: 'default',
      required: 'empty',
      notOneOf: 'alreadyExists',
    },
    string: {
      url: 'invalidUrl',
    },
  });

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
        exampleUrl: document.querySelector('.example-url'),
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
          state: 'filling',
          fields: { url: '' },
          error: '',
        },
        modal: {
          title: '',
          description: '',
          link: '',
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
        state.form.fields.url = elements.urlInput.value.trim();
        e.preventDefault();
        state.form.error = '';

        const getFeedUrls = state.feeds.map(({ link }) => link);
        const schema = string()
          .required()
          .url()
          .notOneOf(getFeedUrls);

        schema
          .validate(state.form.fields.url)
          .then(() => {
            state.form.state = 'sending';
            return getHttpContents(state.form.fields.url);
          })
          .then(parseRSS)
          .then((parsedRSS) => {
            const feedId = getId();

            const feed = {
              id: feedId,
              title: parsedRSS.title,
              description: parsedRSS.description,
              link: state.form.fields.url,
            };
            state.feeds.push(feed);
            addPosts(feedId, parsedRSS.items, state);
            setAutoUpdade(feedId, state);

            state.form.fields.url = '';
          })
          .catch((error) => {
            const message = error.message ?? 'default';
            state.form.error = message;
          })
          .finally(() => {
            state.form.state = 'filling';
          });
      });

      elements.exampleUrl.addEventListener('click', (e) => {
        e.preventDefault();
        state.form.fields.url = e.target.textContent.trim();
      });

      elements.posts.addEventListener('click', (e) => {
        const postId = parseInt(e.target.dataset.id, 10);
        const post = state.posts
          .find(({ id }) => postId === id);
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
    });
};
